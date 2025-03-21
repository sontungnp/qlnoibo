'use strict';

document.addEventListener("DOMContentLoaded", () => {
    tableau.extensions.initializeAsync().then(() => {
        let worksheet = tableau.extensions.dashboardContent.dashboard.worksheets[0];

        worksheet.getSummaryDataAsync().then(function (sumData) {
            let columns = sumData.columns.map(col => col.fieldName);
            let data = sumData.data;

            // Kiểm tra có cột Measure Names không
            const measureNameIndex = columns.indexOf("Measure Names");
            const measureValueIndex = columns.indexOf("Measure Values");

            // Bỏ các cột không cần thiết như "AGG(index)"
            const validDimensionCols = columns.filter((col, idx) =>
                !col.includes("AGG") && idx !== measureNameIndex && idx !== measureValueIndex
            );

            let measureCols = [];
            if (measureNameIndex !== -1) {
                // Tìm tất cả các giá trị measure
                measureCols = [...new Set(data.map(row => row[measureNameIndex].formattedValue))];

                // Tạo header và filter (bỏ cột không cần thiết)
                validDimensionCols.forEach(col => {
                    $('#table-header').append(`<th>${col}</th>`);
                    $('#table-filters').append(`<th><input type="text" class="column-filter" placeholder="Filter ${col}" /></th>`);
                });
                measureCols.forEach(measure => {
                    $('#table-header').append(`<th>${measure}</th>`);
                    $('#table-filters').append(`<th><input type="text" class="column-filter" placeholder="Filter ${measure}" /></th>`);
                });

                // Pivot dữ liệu
                let pivotData = {};
                data.forEach(row => {
                    let dimensionKey = validDimensionCols.map(col =>
                        row[columns.indexOf(col)].formattedValue
                    ).join("|");

                    if (!pivotData[dimensionKey]) {
                        pivotData[dimensionKey] = {};
                        validDimensionCols.forEach(col => {
                            pivotData[dimensionKey][col] = row[columns.indexOf(col)].formattedValue;
                        });
                        measureCols.forEach(measure => {
                            pivotData[dimensionKey][measure] = "";
                        });
                    }

                    let measureName = row[measureNameIndex].formattedValue;
                    let measureValue = row[measureValueIndex].formattedValue;
                    pivotData[dimensionKey][measureName] = measureValue;
                });

                // Hiển thị dữ liệu pivot trong bảng
                Object.values(pivotData).forEach(row => {
                    let rowHTML = "<tr>";
                    validDimensionCols.forEach(col => rowHTML += `<td>${row[col]}</td>`);
                    measureCols.forEach(measure => rowHTML += `<td>${row[measure]}</td>`);
                    rowHTML += "</tr>";
                    $('#table-body').append(rowHTML);
                });
            } else {

                // Tạo hàng tiêu đề
                columns.forEach(col => {
                    $('#table-header').append(`<th>${col}</th>`);
                });

                // Tạo hàng filter ngay dưới tiêu đề
                columns.forEach((col, index) => {
                    let uniqueValues = [...new Set(data.map(row => row[index].formattedValue))];
                    let select = `<select class="column-filter" id="filter-${index}" onchange="filterColumn(${index})">
                                    <option value="">All ${col}</option>`;
                    uniqueValues.forEach(value => {
                        select += `<option value="${value}">${value}</option>`;
                    });
                    select += `</select>`;
                    $('#table-filters').append(`<th>${select}</th>`);
                });

                // Thêm dữ liệu vào bảng
                data.forEach(row => {
                    let rowHTML = '<tr>';
                    row.forEach(cell => {
                        rowHTML += `<td>${cell.formattedValue}</td>`;
                    });
                    rowHTML += '</tr>';
                    $('#table-body').append(rowHTML);
                });
            }

            // Kích hoạt DataTable
            let table = $('#data-table').DataTable({
                paging: true,
                searching: true,
                ordering: true,
                pageLength: 10,
                dom: '<"top-controls"lBf>rtip', // Định vị controls lên trên
                buttons: [
                    {
                        extend: 'excelHtml5',
                        text: 'Export to Excel',
                        title: 'Exported_Data'
                    }
                ]
            });

            // Di chuyển các control vào vị trí mong muốn
            $('#table-length').html($('.dataTables_length'));
            $('#table-search').html($('.dataTables_filter'));
            $('#table-export').html($('.dt-buttons'));

            // Hàm filter theo từng cột
            window.filterColumn = function (index) {
                let val = $(`#filter-${index}`).val();
                table.column(index).search(val ? `^${val}$` : '', true, false).draw();
            };

            // Sự kiện click để highlight 1 dòng
            // $('#table-body').on('click', 'tr', function() {
            //     $('#table-body tr').removeClass('highlight');  // Xóa highlight của các dòng khác
            //     $(this).addClass('highlight');  // Thêm highlight cho dòng được click
            // });

            // Sự kiện click để highlight nhiều dòng
            let lastSelectedRow = null; // Lưu trữ dòng được chọn cuối cùng

            $('#table-body').on('click', 'tr', function(event) {
                if (event.ctrlKey) {
                    // Nhấn Ctrl: Chọn/bỏ chọn dòng hiện tại
                    $(this).toggleClass('highlight');
                } else if (event.shiftKey && lastSelectedRow) {
                    // Nhấn Shift: Chọn nhiều dòng từ lastSelectedRow đến dòng hiện tại
                    let rows = $('#table-body tr');
                    let start = rows.index(lastSelectedRow);
                    let end = rows.index(this);
                    let [min, max] = [Math.min(start, end), Math.max(start, end)];

                    rows.slice(min, max + 1).addClass('highlight');
                } else {
                    // Không nhấn phím nào: Chọn một dòng duy nhất (bỏ chọn các dòng khác)
                    $('#table-body tr').removeClass('highlight');
                    $(this).addClass('highlight');
                }

                lastSelectedRow = this; // Cập nhật dòng cuối cùng được chọn
            });

            // Thêm sự kiện copy bằng nút hoặc phím tắt
            function copySelectedRows() {
                let copiedText = "";
                $('.highlight').each(function () {
                    let rowData = $(this).find('td').map(function () {
                        return $(this).text().trim(); // Lấy nội dung text của từng ô
                    }).get().join("\t"); // Ngăn cách bằng Tab để giữ đúng định dạng Excel
                    copiedText += rowData + "\n";
                });

                if (copiedText) {
                    let textarea = $('<textarea>').val(copiedText).appendTo('body').select();
                    document.execCommand('copy'); // Thực hiện copy
                    textarea.remove(); // Xóa textarea sau khi copy
                    alert("Copied to clipboard!");
                } else {
                    alert("No rows selected!");
                }
            }

            // Gán sự kiện Ctrl + C để copy
            $(document).on('keyup', function (event) {
                console.log(event.key)
                if (event.ctrlKey && (event.key === "c" || event.key === "C") ) {
                    copySelectedRows();
                }
            });

            // $(document).on('copy', function (event) {
            //     copySelectedRows();
            // });

            // Thêm nút Copy vào DataTable
            $('#data-table_wrapper .top-controls').append('<button id="copy-btn" class="btn btn-primary">Copy Selected</button>');

            // Xử lý sự kiện click cho nút Copy
            $('#copy-btn').on('click', function () {
                copySelectedRows();
            });


            // NEW
            // Tạo menu chuột phải
            let contextMenu = $('<ul id="context-menu" class="context-menu"><li id="copy-selected">Copy</li></ul>');
            $('body').append(contextMenu);

            // Ẩn menu khi click ra ngoài
            $(document).on("click", function () {
                $("#context-menu").hide();
            });

            // Hiển thị menu khi chuột phải vào dòng đã chọn
            $('#table-body').on('contextmenu', 'tr.highlight', function (event) {
                event.preventDefault(); // Ngăn menu mặc định của trình duyệt

                // Hiển thị menu tùy chỉnh tại vị trí con trỏ
                $("#context-menu").css({
                    top: event.pageY + "px",
                    left: event.pageX + "px"
                }).show();
            });

            // Xử lý sự kiện khi chọn "Copy" từ menu
            $("#copy-selected").on("click", function () {
                copySelectedRows();
                $("#context-menu").hide();
            });

        });
    });

});
