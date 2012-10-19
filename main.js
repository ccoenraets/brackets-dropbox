/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/** extension to generate & validate cache manifest files */
define(function (require, exports, module) {

    'use strict';

    var dropboxlib              = require("dropbox"),
        dpOpenFolderDialogHtml  = require("text!htmlContent/dp-open-folder-dialog.html");

    var CommandManager      = brackets.getModule("command/CommandManager"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        NativeFileSystem    = brackets.getModule("file/NativeFileSystem").NativeFileSystem,
        FileUtils           = brackets.getModule("file/FileUtils"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        Menus               = brackets.getModule("command/Menus");

    var DROPBOX_MENU = "dropbox-menu",
        DROPBOX_MENU_NAME = "Dropbox",
        AUTH_COMMAND_ID = "dropbox.authorize",
        AUTH_MENU_NAME = "Authorize",
        OPEN_COMMAND_ID = "dropbox.open",
        OPEN_MENU_NAME = "Open Folder...",
        SAVE_COMMAND_ID = "dropbox.save",
        SAVE_MENU_NAME = "Save";

    var dropbox,
        dropboxFiles,
        dropboxFolder,
        moduleDir;

    function showMessage(msg) {
        Dialogs.showModalDialog(Dialogs.DIALOG_ID_ERROR, "Dropbox Extension", msg);
    }

    /**
     * Open a dialog to select a Dropbox folder
     */
    function selectDropboxFolder() {
        readDropboxFolder(dropbox, "/");
        Dialogs.showModalDialog("dp-open-folder-dialog").done(function (id) {
            if (id === 'open') {
                createProjectFiles();
            }
        });
    }

    /**
     * Iterate through the files in the selected Dropbox folder. For each Dropbox file, we create a file in the
     * current Brackets project. The files will be Lazy loaded from Dropbox (they will only be loaded when selected
     * in the project tree)
     */
    function createProjectFiles() {
        var deferreds = [];
        var len  = dropboxFiles.length;
        $(DocumentManager).off("currentDocumentChange", documentChangeHandler);
        for (var i=0; i<len; i++) {
            deferreds.push( createProjectFile(dropboxFiles[i]) );
        }
        $.when.apply(null, deferreds).done(function() {
            console.log('*** all deferreds done, registering currentDocumentChange event');
            $(DocumentManager).on("currentDocumentChange", documentChangeHandler);
            // Force a documentChangeHandler to read the currently selected document from Dropbox
            documentChangeHandler();
        });
    }

    /**
     * Create a new file and add it to the project.
     * @param file
     * @return {*}
     */
    function createProjectFile(file) {
        var deferred = $.Deferred();
        var destinationDir = ProjectManager.getProjectRoot().fullPath;
        ProjectManager.createNewItem(destinationDir, file.name, true).done(function(data) {
            // At this point we know the file has been created
            console.log("done createProjectFile " + file.name);
            DocumentManager.getDocumentForPath(data.fullPath).done(function (doc) {
                console.log("done getDocumentForPath " + file.name);
                // At this point we know the file has been created *and* added to the project: deferred resolved.
                deferred.resolve(doc);
            });
        });
        return deferred;
    }

    /**
     * Read the selected file from Dropbox, if it hasn't already been loaded.
     */
    function documentChangeHandler() {
        var doc = DocumentManager.getCurrentDocument();
        console.log("documentChangeHandler: " + doc.file.name);
        if (doc.getText() === "") {
            readDropboxFile(dropboxFolder + "/" + doc.file.name).done(function(content) {
                doc.setText(content);
            });
        }
    }

    /*
     * Read the text content of a Dropbox file
     */
    function readDropboxFile(path) {
        var deferred = $.Deferred();
        dropbox.readFile(path, function(error, data) {
            if (error) {
                deferred.reject(error);  // Something went wrong.
            }
            deferred.resolve(data);
        });
        return deferred;
    }

    function saveDropboxFile() {
        var doc = DocumentManager.getCurrentDocument();
        dropbox.writeFile(dropboxFolder + "/" + doc.file.name, doc.getText(), function(error, stat) {
            if (error) {
                showMessage(error);  // Something went wrong.
            }
            showMessage("File " + doc.file.name + " saved");
        });
    }

    /**
     * Authorize via Dropbox OAuth
     */
    function authorize() {
        dropbox = new Dropbox.Client({
            key: "ggCaheYC2OA=|rbHoiifVtLfQqLS6uK8cu7SNihetQxMsJkVMPbtwlA==", sandbox: true
        });

        dropbox.authDriver(dropboxOAuthDriver);

        dropbox.authenticate(function (error, client) {
            if (error) {
                showMessage('Authentication error: ' + error);
            }
            client.getUserInfo(function(error, userInfo) {
                if (error) {
                    showMessage(error);
                }
                $('.dropbox-user').html('Dropbox user: ' + userInfo.name);
            });
        });
    }

    /**
     * Read content of Dropbox folder and populate the Open Folder dialog with the list of files
     * @param dropbox
     * @param path
     * @param callback
     */
    function readDropboxFolder(dropbox, path) {
        dropboxFolder = path;
        console.log("Dropbox Folder: " + dropboxFolder);
        displayPath(path);
        $('.dropbox-file-rows').empty();
        dropbox.readdir(path, function(error, fileNames, folder, files) {
            if (error) {
                alert('Error: ' + error);
                return;
            }
            dropboxFiles = files;
            var len = files.length;
            var file;
            console.log('readdir len:' + len);
            console.log($('#dpRows'));
            for (var i = 0; i<len ; i++) {
                file = files[i];
                console.log(moduleDir + '/img/' +  (file.isFile ? "file" : "folder" ) + '.png');
                $('.dropbox-file-rows').append(
                    '<tr data-path=' + file.path + (file.isFolder ? ' class="folder-row"' : '') + '><td class="file-icon">' +
                    '<img src="' + moduleDir + '/img/' +  (file.isFile ? "file" : "folder" ) + '.png"/> ' +
                    "</td><td>" +
                    file.name +
                    "</td><td>" +
                    file.humanSize +
                    "</td><td>" +
                    file.modifiedAt +
                    '</td></tr>');
            }
        });
    }

    /**
     * Display bread crumbs for the path in the Open Folder dialog
     * @param path
     */
    function displayPath(path) {
        var arr = path.split("/");
        var len  = arr.length;
        if (arr[len - 1] == "") {
            arr.pop();
            len = len - 1;
        }
        var html = "";
        var fullPath = "";
        for (var i=0; i<len; i++) {
            var fullPath = fullPath + arr[i] + '/';
            html = html +
                (i==0 ? "" : " / ") + '<a href="#" class="dropbox-path-link" data-path="' + fullPath + '">' + ( i==0 ? 'root' : arr[i] ) + '</a>';
        }
        $('.dropbox-path').html(html);
    }


    function initialize() {

        ExtensionUtils.loadStyleSheet(module, "css/dropbox.css");

        $('body').append($(Mustache.render(dpOpenFolderDialogHtml)));

        // Register commands
        CommandManager.register(AUTH_MENU_NAME, AUTH_COMMAND_ID, authorize);
        CommandManager.register(OPEN_MENU_NAME, OPEN_COMMAND_ID, selectDropboxFolder);
        CommandManager.register(SAVE_MENU_NAME, SAVE_COMMAND_ID, saveDropboxFile);

        // Add menus
        var dropboxMenu =  Menus.getMenu(DROPBOX_MENU);
        if (!dropboxMenu) {
            dropboxMenu = Menus.addMenu(DROPBOX_MENU_NAME, DROPBOX_MENU, Menus.FIRST);
        }

        dropboxMenu.addMenuItem(AUTH_COMMAND_ID);
        dropboxMenu.addMenuDivider();
        dropboxMenu.addMenuItem(OPEN_COMMAND_ID);
        dropboxMenu.addMenuDivider();
        dropboxMenu.addMenuItem(SAVE_COMMAND_ID);

        $('body').on('mouseover', '.folder-row', function(event) {
            $(event.currentTarget).addClass('highlight');
        });

        $('body').on('mouseout', '.folder-row', function(event) {
            $(event.currentTarget).removeClass('highlight');
        });

        $('body').on('click', '.folder-row', function(event) {
            readDropboxFolder(dropbox, $(event.currentTarget).data('path'));
        });

        $('body').on('click', '.dropbox-path-link', function(event) {
            event.stopImmediatePropagation();
            event.preventDefault();
            readDropboxFolder(dropbox, $(event.currentTarget).data('path'));
        });

        moduleDir = FileUtils.getNativeModuleDirectoryPath(module);
    }

    var dropboxOAuthDriver = {
        url: function() { return ""; },
        doAuthorize: function(authUrl, token, tokenSecret, callback) {
            var w = window.open(authUrl);
            // Hack to find out when the dropbox authorization window was closed
            // (check every 500ms to see if it's still there)
            var timer =  setInterval(function() {
                if (w.closed) {
                    clearInterval(timer);
                    callback(token);
                }
            }, 500);
        }
    };

    initialize();

});