# Dropbox extension for Brackets #

A Dropbox integration extension that allows you to open a Dropbox folder in Brackets, edit the Dropbox files in the
Brackets editors, and save the modified files back to Dropbox. The idea behind this extension is to be able to work on
a project hosted in Dropbox from any computer without having to install and configure Dropbox. The extension uses
[dropbox.js](https://github.com/dropbox/dropbox-js) to access the Dropbox OAuth and REST APIs.

Watch the [video](http://www.youtube.com/watch?v=WzrmGCqC_uE&feature=share&list=UUa-0FYdNAFp9Fp9dtR1ETXg).

This extension is a PROOF OF CONCEPT and is not suitable for production use yet. However, the basic functionality is there, and I thought it would be interesting to share it at this stage. Some of the limitations include:

1.  It creates a local version of the files. Ideally I’d like it to work without any local files being created.
2.  It doesn’t handle subfolders (Brackets Sprint 14 doesn’t provide an API to create folders)
3.  If you restart Brackets, it doesn’t reconnect the local project folder with the Dropbox folder. You have to open a new empty folder on your local file system and Open the Dropbox folder again.
