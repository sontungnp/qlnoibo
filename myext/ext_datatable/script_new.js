'use strict'

// Pivot Measure Names/Values
function pivotMeasureValues(table) {
  const cols = table.columns.map((c) => c.fieldName)
  const rows = table.data.map((r) =>
    r.map((c) =>
      c.formattedValue === null || c.formattedValue === undefined
        ? ''
        : c.formattedValue
    )
  )

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

// Load lại dữ liệu và render
function loadAndRender(worksheet) {
  worksheet.getSummaryDataAsync({ maxRows: 0 }).then((sumData) => {
    const { headers, data, isMeasure } = pivotMeasureValues(sumData)

    const colWidths = headers.map((h, idx) => {
      const headerWidth = getTextWidth(h)
      const maxCellWidth = Math.max(
        ...data.map((r) => getTextWidth(r[idx] || ''))
      )
      const rawWidth = Math.max(headerWidth, maxCellWidth) + 20
      return Math.min(300, Math.max(30, rawWidth)) // giới hạn min = 30, max = 300
    })

    renderTable(headers, data, colWidths, isMeasure)

    // Lưu global cho applyFilterGlobal
    const columnsToHide = headers
      .map((header, index) => ({ header, index }))
      .filter(
        (item) =>
          item.header.toLowerCase().startsWith('hiden') ||
          item.header.startsWith('AGG')
      )
      .map((item) => item.index)

    window.currentVisibleData = data.map((row) =>
      row.filter((cell, index) => !columnsToHide.includes(index))
    ) // Sử dụng window để global
    window.currentVisibleIsMeasure = isMeasure.filter(
      (measure, index) => !columnsToHide.includes(index)
    )

    // Sau khi render xong, lấy width thực của table
    const tableEl = document.getElementById('data-table')
    const headerContainer = document.querySelector('.header-container')
    if (tableEl && headerContainer) {
      const tableWidth = tableEl.offsetWidth
      headerContainer.style.width = tableWidth + 'px'
    }

    attachGlobalSearch()
  })
}

// Khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
  tableau.extensions.initializeAsync().then(() => {
    const worksheet =
      tableau.extensions.dashboardContent.dashboard.worksheets[0]

    // Load lần đầu
    loadAndRender(worksheet)

    // Lắng nghe filter và parameter change
    worksheet.addEventListener(tableau.TableauEventType.FilterChanged, () => {
      loadAndRender(worksheet)
    })

    tableau.extensions.dashboardContent.dashboard
      .getParametersAsync()
      .then(function (parameters) {
        parameters.forEach(function (p) {
          p.addEventListener(tableau.TableauEventType.ParameterChanged, () =>
            loadAndRender(worksheet)
          )
        })
      })
  })
})
