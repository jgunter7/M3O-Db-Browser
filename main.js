let _maxPage = 0;
let _curPage = 1;
let _tableName = '';
let _tables = [];
let _idToDelete = undefined;
const _itemsPerPage = 10;

$(document).foundation();

$(document).ready(function () {
    $("#txtApiKey").val(localStorage.getItem("ApiKey"));
    $("#txtTableNames").val(localStorage.getItem("TableNames"));
    loadTables();
});

function loading() {
    $(".modal").show();
}

function loadingDone() {
    $(".modal").hide();
}

$(document).on("click", "#tblMenu li", function () {
    _tableName = $(this).text();
    _curPage = 1;
    loadTables(); // change active flag
    loadPage();
});

$("#btnNext").on("click", function () {
    if (_curPage < _maxPage) {
        _curPage = _curPage + 1;
        loadPage();
    } else {
        toast("There are no more pages in this table");
    }
});

$("#btnPrev").on("click", function () {
    if (_curPage != 1) {
        _curPage = _curPage - 1;
        loadPage();
    } else {
        toast("You are on the first page");
    }
});

$("#txtTableNames").on("change", function () {
    localStorage.setItem("TableNames", $("#txtTableNames").val());
    loadTables();
});
$("#txtApiKey").on("change", function () {
    localStorage.setItem("ApiKey", $("#txtApiKey").val());
});

$("#btnGo").on("click", function () {
    let pgNum = $("#txtPageNumber").val();
    if (pgNum == undefined || pgNum < 1 || pgNum > _maxPage) {
        toast("Page number out of bounds");
        pgNum = 1;
    }
    _curPage = pgNum;
    loadPage();
});

$("#btnCreate").on("click", function () {
    let json = $("#json").val();
    let jsonObj = JSON.parse(json);
    if (jsonObj["id"] == undefined) {
        // CREATE new record
        db_create(jsonObj);
    } else {
        // UPDATE existing record
        db_update(jsonObj);
    }
});

$("#btnDelete").on("click", function () {
    let idx = 0;
    $("#tblOutput th").each(function () {
        if ($(this)[0].innerHTML != "id") {
            idx = idx + 1;
        } else {
            return false;
        }
    });

    $("#tblOutput td").each(function () {
        if ($(this)[0].cellIndex == idx) {
            let id = $(this)[0].innerHTML;
            let lio = id.lastIndexOf("</i>&nbsp;&nbsp;");
            if (lio <= 0) {
                deleteRecordImpl(id, false);
            } else {
                deleteRecordImpl(id.substring(lio + 16, id.length), false);
            }
        }
    });
});

$("#btnPretty").on("click", function () {
    let json = $("#json").val();
    let prettyJson = JSON.stringify(JSON.parse(json), undefined, 2);
    $("#json").val(prettyJson);
});

function loadTables() {
    _tables = $("#txtTableNames").val().split(",");
    _tables = _tables.sort((a, b) => a.localeCompare(b));
    $("#tblMenu").html("");
    _tables.forEach(tbl => {
        $("#tblMenu").append(`<li class="${((tbl == _tableName) ? "active" : "")}">${tbl}</li>`)
    });
}

function loadPage() {
    localStorage.clear();
    localStorage.setItem("TableNames", $("#txtTableNames").val());
    localStorage.setItem("ApiKey", $("#txtApiKey").val());
    if (_tableName != '') {
        $("#tableName").html(`Table: ${_tableName}`);
        db_read();
        db_count();
    } else {
        // no table selected, clear the screen
        $("#tableName").html(`Table: `);
        $("#tblOutpt").html(``);
    }
    $("#pgNum").html(`Page ${_curPage}`);
}

function loadJson(uuid) {
    let json = localStorage.getItem(uuid);
    let prettyJson = JSON.stringify(JSON.parse(json), undefined, 2);
    $("#json").val(prettyJson);
}

function deleteRecord(id) {
    if (_idToDelete == id) {
        deleteRecordImpl(id);
    } else {
        _idToDelete = id;
        toast("Press delete again to delete this record permanently");
    }
}

function deleteRecordImpl(id, loadAfter = true) {
    loading();
    let payload = JSON.stringify({ "id": `${id}`, "table": `${_tableName}` });
    makeApiCall("Delete", "POST", payload, function (response) {
        loadingDone();
        toast("Record deleted");
        if (loadAfter) loadPage();
    });
}

function db_read() {
    loading();
    let offset = (_curPage - 1) * _itemsPerPage;
    let payload = JSON.stringify({ "limit": _itemsPerPage, "offset": offset, "table": `${_tableName}` });
    makeApiCall("Read", "POST", payload, function (response) {
        $("#tblOutput").html("<tbody></tbody>");
        let records = JSON.parse(response).records;
        let headerDone = false;
        for (let i = 0; i < records.length; i++) {
            let keys = Object.keys(records[i]);
            if (!headerDone) {
                let html = "<tr>";
                for (let y = 0; y < keys.length; y++) {
                    html += `<th>${keys[y]}</th>`;
                }
                html += "</tr>";
                $("#tblOutput").append(html);
                headerDone = true;
            }
            let html = "<tr>";
            for (let y = 0; y < keys.length; y++) {
                html += "<td>";
                if (y == 0) {
                    let uuid = createUUID();
                    html += `<i alt="copy" title="copy" class="fi-page-copy" style="font-size:1.5rem" onclick="loadJson('${uuid}')"></i>`;
                    html += `&nbsp;&nbsp;<i alt="del" title="del" class="fi-trash" style="font-size:1.5rem" onclick="deleteRecord('${records[i]["id"]}')"></i>&nbsp;&nbsp;`;
                    localStorage.setItem(uuid, JSON.stringify(records[i]));
                }
                html += `${records[i][keys[y]]}`;
                html += "</td>";
            }
            html += "</tr>";
            $("#tblOutput").append(html);
        }
        loadingDone();
        toast(`Loaded table '${_tableName}' page ${_curPage} `);
    });
}

function db_update(jsonObj) {
    loading();
    let payload = JSON.stringify({ "record": jsonObj, "table": `${_tableName}` });
    makeApiCall("Update", "POST", payload, function (response) {
        loadingDone();
        toast("Record updated");
        loadPage();
    });
}

function db_create(jsonObj) {
    loading();
    let payload = JSON.stringify({ "record": jsonObj, "table": `${_tableName}` });

    makeApiCall("Create", "POST", payload, function (response) {
        loadingDone();
        toast("Record created");
        loadPage();
    });
}

function db_count() {
    let payload = JSON.stringify({ "table": `${_tableName}` });

    makeApiCall("Count", "POST", payload, function (response) {
        let count = JSON.parse(response).count;
        _maxPage = Math.ceil(count / _itemsPerPage);
    });
}

function makeApiCall(endpoint, httpMethod, payload, onDone) {
    let apiKey = $("#txtApiKey").val();
    var settings = {
        "url": `https://api.m3o.com/v1/db/Db/${endpoint}`,
        "method": `${httpMethod}`,
        "timeout": 0,
        "headers": {
            "Micro-Namespace": "micro",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        "data": payload,
    };

    $.ajax(settings).done(function (response) {
        onDone(response);
    });
}

// helper functions
function createUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function toast(msg) {
    const options = {
        style: {
            main: {
                background: "#222",
                color: "#fff",
            },
        },
        settings: {
            duration: 1000,
        }
    };
    iqwerty.toast.toast(msg, options);
}