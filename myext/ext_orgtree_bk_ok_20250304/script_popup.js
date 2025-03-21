'use strict';

tableau.extensions.initializeDialogAsync().then(async (payload) => { // Sử dụng async ở đây
    let selectedItems = [];
    let expandLevel = 2; // Giá trị này có thể nhận từ tham số truyền vào

    console.log("Popup mở thành công! Giá trị nhận được payload là: ");
    console.log(payload);

    document.getElementById("search-box").addEventListener("input", filterTree);

    document.getElementById("expandAll").addEventListener("click", () => {
        expandalltree();
    });
    
    document.getElementById("collapseAll").addEventListener("click", () => {
        document.querySelectorAll(".children").forEach(child => {
            child.style.display = "none";
        });
        document.querySelectorAll(".toggle").forEach(toggle => {
            if (toggle.textContent === "▼") toggle.textContent = "▶";
        });
    });    

    document.getElementById("okPopup").addEventListener("click", () => {
        returnData("ok");
    });

    document.getElementById("closePopup").addEventListener("click", function () {
        returnData("cancel");

    });

    let popupData = JSON.parse(payload);
    let treeData;

    // lấy từ localstorage
    let localOrgTreeData = localStorage.getItem("orgTreeData");
    if (localOrgTreeData) {
        // console.log('OrgTreeData lấy trong localstorage', treeData)
        treeData = JSON.parse(localOrgTreeData)
    } else {
        // console.log('OrgTreeData lấy từ biến truyền vào')
        treeData = popupData.treeData;
        // lưu vào localstorage
        localStorage.setItem("orgTreeData", JSON.stringify(treeData));
    }

    let showIds = popupData.selectedData.showIds; 
    let lstSelectedCodes = popupData.selectedData.selectedCodes
    let arrSelectedCodes = lstSelectedCodes.split(",").map(code => code.trim());
    expandLevel = popupData.selectedData.maxLevel ? popupData.selectedData.maxLevel : 2
    
    renderTree(treeData, document.getElementById("tree-container"), null, 1, 2); // chuyen lai luon show level 2
    selectAndExpandNodes(showIds);
    // selectAndExpandNodesByCode(arrSelectedCodes);

    let container = document.getElementById("tree-container");
    container.style.display = container.style.display === "block" ? "none" : "block";

    function expandalltree() {
        document.querySelectorAll(".children").forEach(child => {
            child.style.display = "block";
        });
        document.querySelectorAll(".toggle").forEach(toggle => {
            if (toggle.textContent === "▶") toggle.textContent = "▼";
        });
    }

    function renderTree(node, container, parent = null, level = 1, expandLevel = 2) {
        if (!node) return;
        node.parent = parent;

        let div = document.createElement("div");
        div.classList.add("node");

        let toggle = document.createElement("span");
        toggle.classList.add("toggle");
        toggle.textContent = node.children.length ? (level <= expandLevel ? "▼" : "▶") : "";
        toggle.addEventListener("click", function (event) {
            event.stopPropagation();
            let parent = this.parentElement;
            let childrenContainer = parent.nextElementSibling;
            if (childrenContainer) {
                let isExpanded = childrenContainer.style.display === "block";
                childrenContainer.style.display = isExpanded ? "none" : "block";
                this.textContent = isExpanded ? "▶" : "▼";
            }
        });

        let checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.id = node.id;
        checkbox.addEventListener("change", function () {
            toggleChildren(node, this.checked);
            updateParentState(node.parent);
            updateSelectedItems(); // 🔥 CẬP NHẬT DANH SÁCH 🔥
        });

        div.appendChild(toggle);
        div.appendChild(checkbox);
        div.appendChild(document.createTextNode(node.name));
        container.appendChild(div);

        if (node.children.length) {
            let childrenContainer = document.createElement("div");
            childrenContainer.classList.add("children");
            container.appendChild(childrenContainer);

            if (level <= expandLevel) {
                childrenContainer.style.display = "block"; // Mở rộng theo tham số truyền vào
            }

            node.children.forEach(child => renderTree(child, childrenContainer, node, level + 1, expandLevel));
        }
    }

    function selectAndExpandNodes(selectedIds) {
        if (!selectedIds || !Array.isArray(selectedIds) || selectedIds.length === 0) {
            return;
        }
    
        selectedIds.forEach(id => {
            let checkbox = document.querySelector(`input[data-id='${id}']`);
            if (checkbox) {
                checkbox.checked = true; // ✅ Chọn checkbox
                checkbox.dispatchEvent(new Event('change', { bubbles: true })); // Kích hoạt sự kiện thay đổi
            }
        });
    }

    function filterTree() {
        expandalltree();
        let query = document.getElementById("search-box").value.toLowerCase();
        document.querySelectorAll(".node").forEach(node => {
            let text = node.textContent.toLowerCase();
            node.style.display = text.includes(query) ? "flex" : "none";
        });
    }

    function toggleChildren(node, checked) {
        node.children.forEach(child => {
            let checkbox = document.querySelector(`input[data-id='${child.id}']`);
            if (checkbox) {
                checkbox.checked = checked;
                checkbox.indeterminate = false; // Bổ sung để đảm bảo không có trạng thái trung gian
                toggleChildren(child, checked);
            }
        });
    }

    function updateParentState(node) {
        if (!node) return;
        let parentCheckbox = document.querySelector(`input[data-id='${node.id}']`);
        let childCheckboxes = node.children.map(child => document.querySelector(`input[data-id='${child.id}']`)).filter(checkbox => checkbox !== null);
    
        let allChecked = childCheckboxes.length > 0 && childCheckboxes.every(checkbox => checkbox.checked);
        let someChecked = childCheckboxes.some(checkbox => checkbox.checked || checkbox.indeterminate);
    
        parentCheckbox.checked = allChecked;
        parentCheckbox.indeterminate = !allChecked && someChecked;
    
        updateParentState(node.parent);
    }

    function updateSelectedItems() { 
        selectedItems = [];  // 🔥 XÓA DANH SÁCH CŨ 🔥
        document.querySelectorAll("input[type='checkbox']:checked").forEach(checkbox => {
            let id = checkbox.dataset.id;
            let node = findNodeById(treeData, id);
            if (node) {
                let isBranch = node.children.length > 0;
                
                // 🔥 Kiểm tra nếu cha có được chọn hay không
                let parentNode = node.parent;
                let parentChecked = parentNode ? document.querySelector(`input[data-id='${parentNode.id}']`).checked : false;
    
                // 🔥 Cập nhật điều kiện "display"
                let display = (!parentChecked) ? "show" : "";
    
                selectedItems.push({
                    id: node.id,
                    name: node.name,
                    code: node.code,
                    level: getLevel(node),
                    type: isBranch ? "Cành" : "Lá",
                    selection: isBranch ? "Tất cả" : "N/A",
                    display: display // 🔥 THÊM TRƯỜNG "DISPLAY"
                });
            }
        });
        // renderSelectedItemsTable();  // 🔥 CẬP NHẬT BẢNG 🔥// Bật lên khi cần check
        updateSelectedBox(); // 🔥 Cập nhật ô input 🔥
    }
    
    /*
    function renderSelectedItemsTable() { 
        let table = document.getElementById("selected-items-table"); 
        let tbody = table.querySelector("tbody"); 
        tbody.innerHTML = ""; // 🔥 XÓA DỮ LIỆU CŨ 🔥
    
        selectedItems.forEach(item => { 
            let row = document.createElement("tr"); 
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${item.level}</td>
                <td>${item.type}</td>
                <td>${item.selection}</td>
                <td>${item.display}</td> <!-- 🔥 HIỂN THỊ CỘT MỚI -->
            `; 
            tbody.appendChild(row); 
        }); 
    }    
        */
    
    function findNodeById(node, id) {
        if (!node) return null;
        if (node.id == id) return node;
        for (let child of node.children) {
            let found = findNodeById(child, id);
            if (found) return found;
        }
        return null;
    }

    function findNodeByCode(node, code) {
        if (!node) return null;
        if (node.code == code) return node;
        for (let child of node.children) {
            let found = findNodeByCode(child, code);
            if (found) return found;
        }
        return null;
    }

    function getLevel(node) {
        let level = 1;
        while (node.parent) {
            level++;
            node = node.parent;
        }
        return level;
    }

    function returnData(action) {
        let selectedIds = selectedItems
            .map(item => item.id);
    
        let showIds = selectedItems
            .filter(item => item.display === "show")
            .map(item => item.id);
    
        let isAll = (showIds.length === 1 && (showIds[0] === "ALL" || showIds[0] === "all" || showIds[0] === "FIS00000001")) ? "ALL" : "NOTALL";

        // Lấy giá trị lớn nhất của level
        let maxLevel = Math.max(...selectedItems.map(item => item.level || 0));

        let returnValues = {
            "action": action,
            "selectedIds": selectedIds,
            "selectedCodes": document.getElementById("selected-box").value,
            "showIds": showIds,
            "isAll": isAll,
            "maxLevel": maxLevel
        };
    
        console.log("Dữ liệu trả về:", returnValues);
        tableau.extensions.ui.closeDialog(JSON.stringify(returnValues));
    }

    function updateSelectedBox() {
        let selectedCodes = selectedItems
            .filter(item => item.code != "%null%" && item.code != null && item.code !== "") // Chỉ lấy các item có code khác null
            .map(item => item.code); // Lấy code của item

        document.getElementById("selected-box").value = selectedCodes.join(", "); // Gán vào ô input
    }

    document.getElementById("checking-buttons").addEventListener("click", () => {
        tickNodeByTypingCode();
    });

    function findNodeByName(node, name) {
        if (!node) return null;
        if (node.name === name) return node;
        for (let child of node.children) {
            let found = findNodeByName(child, name);
            if (found) return found;
        }
        return null;
    };

    function tickNodeByTypingCode() {
        let inputValue = document.getElementById("selected-box").value.trim(); // Lấy giá trị và loại bỏ khoảng trắng ở đầu và cuối
        let unitCodes = inputValue.split(",").map(code => code.trim()); // Tách các tên đơn vị bằng dấu phẩy và loại bỏ khoảng trắng

        // Xóa tất cả các checkbox đã chọn trước đó
        document.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
            checkbox.checked = false;
            checkbox.indeterminate = false;
        });

        selectAndExpandNodesByCode(unitCodes);
    }

    function selectAndExpandNodesByCode(selectedCodes) {
        if (!selectedCodes || !Array.isArray(selectedCodes) || selectedCodes.length === 0 || selectedCodes.every(code => !code)) {
            selectedItems = [];
            return;
        }
    
        selectedCodes.forEach(code => {
            let node = findNodeByCode(treeData, code); // Tìm node theo code
            if (node) {
                let checkbox = document.querySelector(`input[data-id='${node.id}']`);
                if (checkbox) {
                    checkbox.checked = true; // ✅ Chọn checkbox
                    checkbox.dispatchEvent(new Event('change', { bubbles: true })); // Kích hoạt sự kiện thay đổi
                    expandParentNodes(node); // Mở rộng các cấp cha
                }
            }
        });
    }

    function expandParentNodes(node) {
        while (node.parent) {
            let parent = node.parent;
            let toggle = document.querySelector(`input[data-id='${parent.id}']`).parentElement.querySelector(".toggle");
            let childrenContainer = toggle.parentElement.nextElementSibling;

            if (toggle && toggle.textContent === "▶") {
                toggle.textContent = "▼";
            }
            if (childrenContainer) {
                childrenContainer.style.display = "block";
            }

            node = parent;
        }
    }
});
