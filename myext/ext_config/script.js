'use strict';

document.addEventListener("DOMContentLoaded", () => {
    tableau.extensions.initializeAsync().then(() => {
        let table;

        $("#load-data").click(async function () {
            await tableau.extensions.initializeAsync();
            let dashboard = tableau.extensions.dashboardContent.dashboard;
            let worksheet = dashboard.worksheets[0];
            let data = await worksheet.getSummaryDataAsync();

            let columns = data.columns.map(col => ({ title: col.fieldName, field: col.fieldName, headerFilter: "input" }));
            let rows = data.data.map(row => {
                let obj = {};
                row.forEach((cell, i) => obj[data.columns[i].fieldName] = cell.value);
                return obj;
            });

            if (table) table.destroy();
            table = new Tabulator("#table-container", {
                data: rows,
                columns: columns,
                layout: "fitDataStretch",
                pagination: true,
                paginationSize: 10,
                movableColumns: true,
                clipboard: true,
                clipboardCopyConfig: { rowHeaders: false, columnHeaders: false },
            });

            $("#filter").on("keyup", function () {
                table.setFilter("any", "like", $(this).val());
            });
        });

        $("#download-excel").click(() => {
            table.download("xlsx", "data.xlsx", { sheetName: "Table Data" });
        });
    });

});
