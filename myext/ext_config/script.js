'use strict';

document.addEventListener("DOMContentLoaded", () => {
    tableau.extensions.initializeAsync().then(() => {
        let hot; // Biến chứa bảng dữ liệu

        // Kết nối tới Tableau khi nhấn Load Data
        document.getElementById("loadData").addEventListener("click", function () {
            tableau.extensions.initializeAsync().then(() => {
                const dashboard = tableau.extensions.dashboardContent.dashboard;
                const worksheet = dashboard.worksheets[0]; // Lấy worksheet đầu tiên

                worksheet.getSummaryDataAsync().then((dataTable) => {
                    const fieldNames = dataTable.columns.map(col => col.fieldName);
                    const dataValues = dataTable.data.map(row => row.map(cell => cell.formattedValue));

                    renderTable(fieldNames, dataValues);
                });
            });
        });

        // Hàm hiển thị bảng với Handsontable
        function renderTable(columns, data) {
            const container = document.getElementById("tableContainer");
            container.innerHTML = ""; // Xóa bảng cũ nếu có

            hot = new Handsontable(container, {
                data: data,
                colHeaders: columns,
                rowHeaders: true,
                dropdownMenu: true,
                filters: true,
                manualColumnResize: true,
                manualRowResize: true,
                columnSorting: true,
                contextMenu: true,
                licenseKey: "non-commercial-and-evaluation"
            });
        }

        // Xuất dữ liệu ra CSV
        document.getElementById("exportCSV").addEventListener("click", function () {
            if (hot) {
                const csv = Handsontable.plugins.ExportFile.getPlugin(hot, 'exportFile');
                csv.downloadFile('csv', {filename: 'tableau_data'});
            }
        });
    });

});
