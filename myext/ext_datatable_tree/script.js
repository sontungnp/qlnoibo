'use strict'

let selectedRows = new Set() // lưu index của các dòng được chọn
let lastClickedIndex = null

// click chọn dòng
function attachRowClick(tr) {
  tr.addEventListener('click', (event) => {
    let allRows = Array.from(tr.parentNode.querySelectorAll('tr'))
    let rowIndex = allRows.indexOf(tr) // xác định index thực tế trong tbody

    if (event.shiftKey && lastClickedIndex !== null) {
      let start = Math.min(lastClickedIndex, rowIndex)
      let end = Math.max(lastClickedIndex, rowIndex)
      allRows.forEach((r, i) => {
        if (i >= start && i <= end) {
          r.classList.add('selected')
          selectedRows.add(i)
        }
      })
    } else if (event.ctrlKey || event.metaKey) {
      if (tr.classList.contains('selected')) {
        tr.classList.remove('selected')
        selectedRows.delete(rowIndex)
      } else {
        tr.classList.add('selected')
        selectedRows.add(rowIndex)
      }
      lastClickedIndex = rowIndex
    } else {
      // clear tất cả
      allRows.forEach((r, i) => r.classList.remove('selected'))
      selectedRows.clear()

      // chọn mới
      tr.classList.add('selected')
      selectedRows.add(rowIndex)
      lastClickedIndex = rowIndex
    }
  })
}

document.addEventListener('DOMContentLoaded', () => {
  tableau.extensions.initializeAsync().then(() => {
    const dashboard = tableau.extensions.dashboardContent.dashboard
    const worksheet = dashboard.worksheets[0] // Assumes the first worksheet; adjust if needed
    worksheet
      .getSummaryDataAsync({ ignoreSelection: true })
      .then((dataTable) => {
        processAndDisplayData(dataTable, worksheet)
      })
  })
})

function processAndDisplayData(dataTable, worksheet) {
  let columns = dataTable.columns
  let data = dataTable.data

  // Step 2: Filter out columns starting with 'hidden'
  const hiddenPrefix = 'hidden'.toLowerCase()
  let keepIndices = columns
    .map((col, i) =>
      col.fieldName.toLowerCase().startsWith(hiddenPrefix) ? -1 : i
    )
    .filter((i) => i >= 0)
  let filteredColumns = keepIndices.map((i) => columns[i])
  let filteredData = data.map((row) => keepIndices.map((i) => row[i]))

  // Step 3: Pivot data if it has 'Measure Names' and 'Measure Values'
  let pivotedColumns = filteredColumns
  let pivotedData = filteredData
  let measureNameIdx = filteredColumns.findIndex(
    (col) => col.fieldName === 'Measure Names'
  )
  let measureValueIdx = filteredColumns.findIndex(
    (col) => col.fieldName === 'Measure Values'
  )
  if (measureNameIdx !== -1 && measureValueIdx !== -1) {
    let dimIndices = filteredColumns
      .map((_, i) => i)
      .filter((i) => i !== measureNameIdx && i !== measureValueIdx)
    let measures = [
      ...new Set(
        filteredData.map(
          (row) =>
            row[measureNameIdx].formattedValue || row[measureNameIdx].value
        )
      )
    ]
    pivotedColumns = dimIndices
      .map((i) => filteredColumns[i])
      .concat(measures.map((m) => ({ fieldName: m, dataType: 'number' })))
    let groupMap = new Map()
    for (let row of filteredData) {
      let key = dimIndices.map((i) => row[i].value ?? 'null').join('||')
      if (!groupMap.has(key)) {
        groupMap.set(key, { dims: dimIndices.map((i) => row[i]), values: {} })
      }
      let m = row[measureNameIdx].formattedValue || row[measureNameIdx].value
      let v = row[measureValueIdx].value
      let fv = row[measureValueIdx].formattedValue
      groupMap.get(key).values[m] = { value: v, formattedValue: fv }
    }
    pivotedData = Array.from(groupMap.values()).map((g) =>
      g.dims.concat(
        measures.map((m) => g.values[m] || { value: null, formattedValue: '' })
      )
    )
  }

  // Step 4: Convert flat data to tree using all tree_l* columns dynamically
  let treeColumns = pivotedColumns
    .map((col, idx) => {
      const match = col.fieldName.match(/^tree_l(\d+)$/)
      return match ? { col, idx, level: parseInt(match[1]) } : null
    })
    .filter((c) => c !== null)
    .sort((a, b) => a.level - b.level)

  if (treeColumns.length === 0) {
    console.error(
      'No tree columns found; fallback to flat display not implemented.'
    )
    return
  }

  let treeIndices = treeColumns.map((c) => c.idx)
  let valueIndices = pivotedColumns
    .map((_, i) => (treeIndices.includes(i) ? -1 : i))
    .filter((i) => i >= 0)
  let tableColumns = [
    { fieldName: 'Hierarchy' },
    ...valueIndices.map((i) => pivotedColumns[i])
  ]

  // Build tree structure
  let root = {
    name: 'Root',
    children: [],
    level: 0,
    isExpanded: true,
    data: null
  }
  let idCounter = 0
  for (let row of pivotedData) {
    let levels = treeIndices.map(
      (idx) => row[idx].formattedValue || row[idx].value
    )
    let current = root
    for (let lev = 0; lev < levels.length; lev++) {
      let name = levels[lev]
      if (name == null || name === '') break
      let child = current.children.find((c) => c.name === name)
      if (!child) {
        child = {
          name,
          children: [],
          level: (current.level || 0) + 1, // ✅ luôn dựa vào cha
          isExpanded: false,
          data: null,
          id: idCounter++
        }
        current.children.push(child)
      }
      current = child
    }
    current.data = valueIndices.map((i) => row[i])
  }

  // Compute aggregates for parent nodes (sum assuming numeric values)
  function computeAggregates(node) {
    if (node.children.length === 0) return
    node.children.forEach(computeAggregates)
    node.data = new Array(valueIndices.length)
      .fill(0)
      .map(() => ({ value: 0, formattedValue: '0' }))
    for (let child of node.children) {
      child.data.forEach((cd, j) => {
        let v = parseFloat(cd.value) || 0
        node.data[j].value += v
        node.data[j].formattedValue = node.data[j].value.toString()
      })
    }
  }
  computeAggregates(root)

  // Step 5: Display in table with header, filter buttons, and tree data
  const thead = document.getElementById('thead')
  let headerTr = document.createElement('tr')
  tableColumns.forEach((col) => {
    let th = document.createElement('th')
    th.textContent = col.fieldName
    headerTr.appendChild(th)
  })
  thead.appendChild(headerTr)

  // Second row: buttons "filter"
  let filterTr = document.createElement('tr')
  tableColumns.forEach((col, i) => {
    let td = document.createElement('th')
    let btn = document.createElement('button')
    btn.textContent = 'Filter'
    btn.classList.add('filter-btn')
    if (i > 0) {
      // Skip hierarchy column
      btn.onclick = () => worksheet.clearFilterAsync(col.fieldName)
    } else {
      btn.disabled = true
    }
    td.appendChild(btn)
    filterTr.appendChild(td)
  })
  thead.appendChild(filterTr)

  const tbody = document.getElementById('tbody')

  // Render tree nodes with dynamic indentation
  function renderNode(node, parent = null) {
    let tr = document.createElement('tr')
    node.row = tr
    let tdName = document.createElement('td')
    tdName.style.paddingLeft = `${node.level * 20}px`
    let expander
    if (node.children.length > 0) {
      expander = document.createElement('button')
      expander.classList.add('expander')
      expander.textContent = node.isExpanded ? '−' : '+'
      expander.title = node.isExpanded ? 'Collapse' : 'Expand'
      expander.onclick = () => toggleExpand(node, expander)
    } else {
      // để giữ chỗ indent, thêm span rỗng nhưng có cùng chiều rộng với expander
      expander = document.createElement('span')
      expander.style.display = 'inline-block'
      expander.style.width = '24px' // bằng với button.expander
    }
    tdName.appendChild(expander)
    tdName.appendChild(document.createTextNode(node.name))
    tr.appendChild(tdName)
    if (node.data) {
      node.data.forEach((d) => {
        let td = document.createElement('td')
        td.textContent = d.formattedValue || d.value || ''
        tr.appendChild(td)
      })
    } else {
      for (let i = 0; i < valueIndices.length; i++) {
        tr.appendChild(document.createElement('td'))
      }
    }
    tbody.appendChild(tr)

    attachRowClick(tr, tbody.rows.length - 1)

    if (parent && !parent.isExpanded) {
      tr.style.display = 'none'
    }
    node.children.forEach((child) => renderNode(child, node))
  }
  root.children.forEach((child) => renderNode(child, root))

  // Step 6: Global search
  window.globalSearch = function () {
    let searchText = document.getElementById('search').value.toLowerCase()
    updateFilter(root, searchText)
    // Update visibility after filter
    if (searchText === '') {
      root.isExpanded = true
      showDescendants(root)
    }
  }

  function updateFilter(node, searchText) {
    let matches = false
    node.children.forEach((child) => {
      if (updateFilter(child, searchText)) matches = true
    })
    let selfMatch = node.name.toLowerCase().includes(searchText)
    if (node.data) {
      selfMatch =
        selfMatch ||
        node.data.some(
          (d) =>
            (d.value?.toString().toLowerCase() || '').includes(searchText) ||
            (d.formattedValue?.toLowerCase() || '').includes(searchText)
        )
    }
    if (selfMatch) matches = true
    if (matches || searchText === '') {
      node.row.style.display = 'table-row'
      if (matches && searchText !== '') node.isExpanded = true
    } else {
      node.row.style.display = 'none'
    }
    return matches
  }
}

function toggleExpand(node, expander) {
  node.isExpanded = !node.isExpanded
  expander.textContent = node.isExpanded ? '−' : '+'
  expander.title = node.isExpanded ? 'Collapse' : 'Expand'
  if (node.isExpanded) {
    node.children.forEach((child) => {
      child.row.style.display = 'table-row'
      if (child.isExpanded) showDescendants(child)
    })
  } else {
    hideDescendants(node)
  }
}

function showDescendants(node) {
  node.children.forEach((child) => {
    child.row.style.display = 'table-row'
    if (child.isExpanded) showDescendants(child)
  })
}

function hideDescendants(node) {
  node.children.forEach((child) => {
    child.row.style.display = 'none'
    hideDescendants(child)
  })
}

// Copy selected rows to clipboard with Ctrl+C
function fallbackCopyText(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
    console.log('Copied with fallback:\n' + text)
  } catch (err) {
    console.error('Fallback copy failed:', err)
  }
  document.body.removeChild(textarea)
}

function copySelectedRows() {
  let tbody = document.getElementById('tbody')
  if (!tbody) return

  let rows = Array.from(tbody.querySelectorAll('tr'))
  let selected = rows.filter((_, idx) => selectedRows.has(idx))
  if (selected.length === 0) return

  let rowsText = selected.map((tr) => {
    let cells = Array.from(tr.querySelectorAll('td'))
    return cells.map((td) => td.textContent.trim()).join('\t')
  })

  let clipboardText = rowsText.join('\n')

  navigator.clipboard
    .writeText(clipboardText)
    .then(() => console.log('Copied:\n' + clipboardText))
    .catch(() => fallbackCopyText(clipboardText)) // fallback nếu bị chặn
}

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    event.preventDefault()
    copySelectedRows()
  }
})
