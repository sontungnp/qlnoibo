'use strict'

const activeFilters = {}

// === Helpers ===
function getTextWidth(text, font = '14px Arial') {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  context.font = font
  return context.measureText(text).width
}
function formatNumber(value) {
  if (value === null || value === undefined || value === '') return ''
  const num = Number(value.toString().replace(/,/g, ''))
  if (isNaN(num)) return value
  return num.toLocaleString('en-US')
}

// === Detect tree headers ===
function detectTreeHeaders(headers) {
  const treeCols = headers
    .map((h, i) => (h.toLowerCase().startsWith('tree_l') ? i : -1))
    .filter((i) => i !== -1)
  return treeCols
}

// === Build tree column ===
function buildTreeData(headers, data, treeCols) {
  const otherCols = headers
    .map((h, i) => i)
    .filter((i) => !treeCols.includes(i))

  const newHeaders = ['Tree', ...otherCols.map((i) => headers[i])]
  const isMeasure = [false, ...otherCols.map(() => false)] // default, refine later

  // Convert rows → tree
  const treeRows = []

  data.forEach((row) => {
    let treePath = treeCols.map((i) => row[i]).filter((v) => v)
    let label = treePath[treePath.length - 1] || ''
    let nodeId = treePath.join('||')

    const otherValues = otherCols.map((i) => row[i])

    treeRows.push({
      nodeId,
      treePath,
      label,
      depth: treePath.length,
      otherValues
    })
  })

  return { headers: newHeaders, data: treeRows, isMeasure }
}

// === Render table ===
function renderTable(headers, treeData, colWidths, isMeasure) {
  const thead = document.getElementById('table-header')
  const tfilter = document.getElementById('table-filter')
  const tbody = document.getElementById('table-body')
  thead.innerHTML = ''
  tfilter.innerHTML = ''
  tbody.innerHTML = ''

  // Header
  headers.forEach((h, idx) => {
    const th = document.createElement('th')
    th.textContent = h
    th.style.backgroundColor = '#f2f2f2'
    th.style.fontWeight = 'bold'
    th.style.minWidth = colWidths[idx] + 'px'
    th.style.textAlign = 'center'
    thead.appendChild(th)
  })

  // Filter row (disabled cho Tree column)
  headers.forEach((h, idx) => {
    const th = document.createElement('th')
    th.style.minWidth = colWidths[idx] + 'px'
    th.style.textAlign = 'center'
    th.style.backgroundColor = '#f2f2f2'
    if (idx !== 0) th.textContent = 'Filter'
    tfilter.appendChild(th)
  })

  // Body
  treeData.forEach((node) => {
    const tr = document.createElement('tr')
    tr.dataset.nodeId = node.nodeId
    tr.dataset.depth = node.depth

    // Tree cell
    const tdTree = document.createElement('td')
    tdTree.classList.add('tree-node')
    tdTree.style.paddingLeft = `${node.depth * 20}px`

    if (node.depth < node.treePath.length) {
      const toggle = document.createElement('span')
      toggle.classList.add('tree-toggle')
      toggle.textContent = '+'
      toggle.onclick = () => {
        const expanded = toggle.textContent === '-'
        toggle.textContent = expanded ? '+' : '-'
        const childRows = tbody.querySelectorAll(
          `tr[data-node-id^="${node.nodeId}||"]`
        )
        childRows.forEach((row) => {
          row.style.display = expanded ? 'none' : ''
        })
      }
      tdTree.appendChild(toggle)
    }

    const labelSpan = document.createElement('span')
    labelSpan.textContent = node.label
    tdTree.appendChild(labelSpan)
    tr.appendChild(tdTree)

    // Other cells
    node.otherValues.forEach((v, idx) => {
      const td = document.createElement('td')
      td.textContent = v
      td.style.textAlign = 'left'
      tr.appendChild(td)
    })

    tbody.appendChild(tr)
  })
}

// === Pivot + Tree integration ===
function pivotMeasureValues(table) {
  const cols = table.columns.map((c) => c.fieldName)
  const rows = table.data.map((r) => r.map((c) => c.formattedValue))

  // Detect tree
  const treeCols = detectTreeHeaders(cols)
  if (treeCols.length > 0) {
    return buildTreeData(cols, rows, treeCols)
  }

  // Fallback = normal pivot
  const measureNameIdx = cols.findIndex((c) =>
    c.toLowerCase().includes('measure names')
  )
  const measureValueIdx = cols.findIndex((c) =>
    c.toLowerCase().includes('measure values')
  )

  const dimensionIdxs = cols
    .map((c, i) => i)
    .filter((i) => i !== measureNameIdx && i !== measureValueIdx)

  const pivotMap = new Map()
  const measureSet = new Set()

  rows.forEach((r) => {
    const dimKey = dimensionIdxs.map((i) => r[i]).join('||')
    const mName = r[measureNameIdx]
    const mValue = r[measureValueIdx]

    measureSet.add(mName)

    if (!pivotMap.has(dimKey)) {
      pivotMap.set(dimKey, {
        dims: dimensionIdxs.map((i) => r[i]),
        measures: {}
      })
    }
    pivotMap.get(dimKey).measures[mName] = mValue
  })

  const measureNames = Array.from(measureSet)
  const headers = [...dimensionIdxs.map((i) => cols[i]), ...measureNames]

  const isMeasure = [
    ...dimensionIdxs.map(() => false),
    ...measureNames.map(() => true)
  ]

  const data = Array.from(pivotMap.values()).map((entry) => {
    return [...entry.dims, ...measureNames.map((m) => entry.measures[m] || '')]
  })

  return { headers, data, isMeasure }
}

// === Load & Render ===
function loadAndRender(worksheet) {
  worksheet.getSummaryDataAsync({ maxRows: 0 }).then((sumData) => {
    const { headers, data, isMeasure } = pivotMeasureValues(sumData)

    const colWidths = headers.map((h, idx) => {
      if (idx === 0) return 200
      const headerWidth = getTextWidth(h)
      const maxCellWidth = Math.max(
        ...data.map((r) =>
          typeof r === 'object'
            ? getTextWidth(r.label || '')
            : getTextWidth(r[idx] || '')
        )
      )
      return Math.max(headerWidth, maxCellWidth) + 20
    })

    renderTable(headers, data, colWidths, isMeasure)
    attachGlobalSearch()
  })
}

// === Search ===
function attachGlobalSearch() {
  const searchInput = document.getElementById('global-search')
  if (!searchInput) return
  searchInput.addEventListener('input', () => {
    const keyword = searchInput.value.toLowerCase()
    const tbody = document.getElementById('table-body')
    tbody.querySelectorAll('tr').forEach((tr) => {
      const rowText = tr.textContent.toLowerCase()
      tr.style.display = rowText.includes(keyword) ? '' : 'none'
    })
  })
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  tableau.extensions.initializeAsync().then(() => {
    const worksheet =
      tableau.extensions.dashboardContent.dashboard.worksheets[0]
    loadAndRender(worksheet)

    worksheet.addEventListener(tableau.TableauEventType.FilterChanged, () => {
      loadAndRender(worksheet)
    })

    tableau.extensions.dashboardContent.dashboard
      .getParametersAsync()
      .then((parameters) => {
        parameters.forEach((p) => {
          p.addEventListener(tableau.TableauEventType.ParameterChanged, () =>
            loadAndRender(worksheet)
          )
        })
      })
  })
})
