/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind,Location,Range,DocumentSymbolParams,SymbolInformation,
	DidOpenTextDocumentParams
} from 'vscode-languageserver';


var parser  = require('@xxxg0001/luaparse');
import * as path from 'path';
import * as fs  from 'fs';

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites. 
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			documentSymbolProvider:true,
			definitionProvider: true
		}
	}
});


class LuaSymbol {
	type:string;
	base:string;
	name:string;
	loc:Location;
	get label():string {
		if (this.base != null) {
			return this.base + ":" + this.name;
		}
		return this.name;
	}
} 


class LuaFile {
	uri:string;
	ischanged:boolean;
	dependency	:string[];
	calls		:Array<{base:any,label:string,range:Range}>;
	symbolslist	:SymbolInformation[];
	luaSymbols	:LuaSymbol[];

	constructor(_uri:string) {
		this.uri = _uri;
		this.reset();
	}

	reset():void {
		this.dependency = [];
		this.calls = [];
		this.symbolslist = [];
		this.luaSymbols = [];
	}
}


var IncludeKeyWords:{ [key:string]:boolean; } = {};
var filesParsed:{ [key:string]:LuaFile; } = {};


/*var cururi = ""*/
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.

documents.onDidChangeContent((change) => {

	//var textContent = change.document.getText();
	var uniuri = uniformPath(change.document.uri);

	var luaFile = filesParsed[uniuri];
	if( !luaFile) {
		luaFile = new LuaFile(uniuri);
		filesParsed[uniuri] = luaFile;
	}
	luaFile.ischanged = true;
	
 });


function uniformPath(pathUri:string):string {
	var uri:string = decodeURIComponent(pathUri);
	uri = uri.replace(/\w:/g, (matchedStr) => {
		return matchedStr.toLowerCase();
	});
	uri = uri.replace(/\\/g, '/');
	return uri;
}

function getLuaSymbolsRecursively(uri:string):LuaSymbol[] {
	var luaFile:LuaFile = filesParsed[uri];
	if( !luaFile) return [];

	var luaSymbols:LuaSymbol[] = luaFile.luaSymbols;
	luaFile.dependency.forEach(element => {
		var dependencySymbols:LuaSymbol[] = getLuaSymbolsRecursively(element);
		luaSymbols = luaSymbols.concat(dependencySymbols);
	});

	return luaSymbols;
}

function parseDependency(parentUri:string, dependencyPath:string) {
	var text = fs.readFileSync(dependencyPath);
	var uri2 = "file:///" + dependencyPath;
	uri2 = uniformPath(uri2);
	
	var luaFile:LuaFile = filesParsed[uri2];
	if( !luaFile) {
		luaFile = new LuaFile(uri2);
		filesParsed[uri2] = luaFile;

		var tb2 = parser.parse(text.toString(), {comments:false, locations:true, luaversion:LuaVersion});
		parse2(uri2, null, tb2, true);
	}

	luaFile = filesParsed[parentUri];
	if(luaFile.dependency.indexOf(uri2) < 0)
		luaFile.dependency.push(uri2);
}

function GetLoc(obj:any):any {

	return  {
		start:{line:obj.loc.start.line - 1,character:obj.loc.start.column},
		end:{line:obj.loc.end.line - 1,character:obj.loc.end.column}
	};
}

function getVariable(tb:any):any {
	switch (tb.type) {
		case "Identifier":
			
			return {
				base: null,
				label:tb.name,
				range:GetLoc(tb)
			}
		case "MemberExpression":
			return {
				base: tb.base.name,
				label:tb.identifier.name,
				range:GetLoc(tb.identifier)
			}
		default:
			return {}
	}
}



function searchluafile(relpath:string, isRequire:boolean = false):string[] {
	// ?;?.lua;$luapath/?;$luapath/?.lua
	if (relpath == null) {
		return null;
	}

	//If lua file is imported by 'require'.
	if(isRequire) {
		relpath = relpath.replace(/\./g, path.sep);
		relpath = path.normalize(relpath);
	}

	let relpath_lua = relpath + ".lua";

	var pathArr:string[] = [
		relpath,
		relpath_lua,
		path.join(workspaceRoot, relpath),
		path.join(workspaceRoot, relpath_lua)
	];
	
	for (var i=0; i < luapaths.length; i++) {
		pathArr.push(path.join(luapaths[i], relpath))
		pathArr.push(path.join(luapaths[i], relpath_lua))
	}
	
	var element:string = null;
	var list:string[] = []
	for (var index = 0; index < pathArr.length; index++) {
		element = pathArr[index];
		if(fs.existsSync(element)) {
			list.push(path.resolve(element));
		}
	}
	return  list;				
}
function updatefile(uri:string) {
	var uniuri = uniformPath(uri);
	var luaFile = filesParsed[uniuri];
	try
	{
		if( !luaFile) {
			luaFile = new LuaFile(uniuri);
			filesParsed[uniuri] = luaFile;
			luaFile.ischanged = false
			var content = documents.get(uri).getText();
			var tb = parser.parse(content, {comments:false, locations:true, luaversion:LuaVersion});
			parse2(uniuri, null, tb, false);
		}
		else if(luaFile.ischanged == true) {
			luaFile.ischanged = false
			var content = documents.get(uri).getText();
			var tb = parser.parse(content, {comments:false, locations:true, luaversion:LuaVersion});
			luaFile.reset();
			parse2(uniuri, null, tb, false);
		}
	}
	catch(err)
	{
		connection.window.showErrorMessage(`${err} : ${uri}`);
	}
	
	
}
function parse2(uri:string, parent:any, tb:any, onlydefine:boolean) {
	switch (tb.type) {
		case "Identifier":
			if (onlydefine) {
				break;
			}
			var name = tb.name;
			var call = {
				uri: uri,
				base: null,
				label:name,
				range:GetLoc(tb)
			}
			filesParsed[uri].calls.push(call);
			break;
		case "IndexExpression":
			if (tb.base != null) {
				parse2(uri, parent, tb.base, onlydefine);			
			}
			if (tb.index != null) {
				parse2(uri, parent, tb.index, onlydefine);
			}
			break;
		case "MemberExpression":
			if (onlydefine) {
				break;
			}
			if (tb.base.type == "IndexExpression") {
				parse2(uri, parent, tb.base, onlydefine);
				break;
			}
			var base = tb.base.name;
			if (base=="self" && parent != null) {
				if (parent.identifier != null && parent.identifier.type == "MemberExpression") {
					base = parent.identifier.base.name						
				}
			}
			var name = tb.identifier.name;
			var call = {
				uri: uri,
				base: base,
				label:name,
				range:GetLoc(tb.identifier)
			}
			filesParsed[uri].calls.push(call);
			break;
		case "LocalStatement":
		case "AssignmentStatement":
			if (tb.variables != null) {
				for (var i=0; i < tb.variables.length; i++) {
					
					var variable = getVariable(tb.variables[i])
					if (tb.init != null && i < tb.init.length) {
						if (tb.init[i].type == "Identifier" || tb.init[i].type == "MemberExpression" || tb.init[i].type == "CallExpression" ) {
							parse2(uri, parent, tb.variables[i], onlydefine);
							continue;
						}
					}
					var luaSymbol = new LuaSymbol;
					if (variable.label == null) {
						parse2(uri, parent, tb.variables[i], onlydefine);
						continue;
					}
					luaSymbol.name = variable.label;
					luaSymbol.base = variable.base;
					
					luaSymbol.loc = {
						uri:uri,
						range:variable.range
					};
					
					filesParsed[uri].luaSymbols.push(luaSymbol);
				}
			}
			if (tb.init != null) {
				for (var i=0; i < tb.init.length; i++) {
					parse2(uri, parent, tb.init[i], onlydefine);
				}
			}
			break;
		case "TableConstructorExpression":
			if (tb.fields != null) {
				for (var i=0; i < tb.fields.length; i++) {
					parse2(uri, parent, tb.fields[i], onlydefine);
				}
			}
			break;
		case "TableKeyString":
		case "TableKey":
			if (tb.key != null) {
				parse2(uri, parent, tb.key, onlydefine);
			}
		case "TableValue":
			if (tb.value != null) {
				parse2(uri, parent, tb.value, onlydefine);
			}
			break;
		case "IfStatement":
			if (tb.clauses != null) {
				for (var i=0; i < tb.clauses.length; i++) {
					parse2(uri, parent, tb.clauses[i], onlydefine);
				}
			}
			break;			
		case "ForNumericStatement":
			if (tb.start != null) {
				parse2(uri, parent, tb.start, onlydefine);
			}
			if (tb.end != null) {
				parse2(uri, parent, tb.end, onlydefine);
			}
			if (tb.body != null) {
				for (var i=0; i < tb.body.length; i++) {
					parse2(uri, parent, tb.body[i], onlydefine);
				}
			}
			break;
		case "ForGenericStatement":
			if (tb.iterators != null) {
				for (var i=0; i < tb.iterators.length; i++) {
					parse2(uri, parent, tb.iterators[i], onlydefine);
				}
			}
			if (tb.body != null) {
				for (var i=0; i < tb.body.length; i++) {
					parse2(uri, parent, tb.body[i], onlydefine);
				}
			}
			break;
		case "ReturnStatement":
			if (tb.arguments != null) {
				for (var i=0; i < tb.arguments.length; i++) {
					parse2(uri, parent, tb.arguments[i], onlydefine);
				}
			}
			break;
		case "CallStatement":
			parse2(uri, parent, tb.expression, onlydefine);
			
			break;
		case "CallExpression":
			if (IncludeKeyWords[tb.base.name] == true) {
				var absPaths = searchluafile(tb.arguments[0].value, tb.base.name == "require");
				for (var i=0; i < absPaths.length;i++) {
					parseDependency(uri, absPaths[i]);
				}
			}
			parse2(uri, parent, tb.base, onlydefine)
			if (tb.arguments != null) {
				for (var i=0; i < tb.arguments.length; i++) {
					parse2(uri, parent, tb.arguments[i], onlydefine);
				}
			}
			break;
		case "BinaryExpression":
		case "LogicalExpression":
			if (tb.left != null) {
				parse2(uri, parent, tb.left, onlydefine);
			}
			if (tb.right != null) {
				parse2(uri, parent, tb.right, onlydefine);
			}
			break;
		case "UnaryExpression":
			if (tb.argument != null) parse2(uri, parent, tb.argument, onlydefine);
			break;
		case "FunctionDeclaration":
			var luaSymbol = new LuaSymbol;
			luaSymbol.type = tb.type;
			if (tb.identifier != null) {
				luaSymbol.name = tb.identifier.name;
				luaSymbol.base = null
				
				if (tb.identifier.type == "MemberExpression") {
					luaSymbol.base = tb.identifier.base.name
					luaSymbol.name = tb.identifier.identifier.name;
				}
				luaSymbol.loc = {
					uri:uri,
					range:GetLoc(tb)
				};
				if (luaSymbol.label == null) {
					
				}
				
				var symbol:SymbolInformation = SymbolInformation.create(luaSymbol.label, 0, GetLoc(tb), uri);
				filesParsed[uri].luaSymbols.push(luaSymbol);
				filesParsed[uri].symbolslist.push(symbol);
			}		
			
			if (tb.body != null) {
				for (var i=0; i < tb.body.length; i++) {
					parse2(uri, tb, tb.body[i], onlydefine);
					
				}
			}
			break;
		
		case "DoStatement":
		case "RepeatStatement":
		case "WhileStatement":
		case "IfClause":
		case "ElseifClause":
			if (tb.condition != null) {
				parse2(uri, parent, tb.condition, onlydefine);
			}
		case "ElseClause":
		case "Chunk":
		
		default:
			
			if (tb.body != null) {
				for (var i=0; i < tb.body.length; i++) {
					parse2(uri, parent, tb.body[i], onlydefine);
				}
			}
			break;

	}
}
// The settings interface describe the server relevant settings part
interface Settings {
	luaforvscode: LuaForVsCodeSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface LuaForVsCodeSettings {
	luapath: string;
	includekeyword: string;
	luaversion: number;
}

// hold the maxNumberOfProblems setting
var luapaths: string[] = [];
let LuaVersion: number;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	
	let settings = <Settings>change.settings;
	luapaths = settings.luaforvscode.luapath.split(";");

	
	
	LuaVersion = settings.luaforvscode.luaversion;
	let includekeyword:string = settings.luaforvscode.includekeyword;
	if (includekeyword == null) {
		includekeyword = ""
	}
	let includeKeyWords = includekeyword.split(",");
	
	if (includeKeyWords.length > 0) {
		IncludeKeyWords = {};
		for (var  keyword of includeKeyWords) {
			IncludeKeyWords[keyword] = true;
		}
	} else {
		IncludeKeyWords = {};
		IncludeKeyWords["Include"] = true
		IncludeKeyWords["Require"] = true
		IncludeKeyWords["require"] = true
		IncludeKeyWords["dofile"] = true
		IncludeKeyWords["include"] = true
	}
	
	
	// Revalidate any open text documents
	
});



connection.onDidChangeWatchedFiles((change) => {
	// Monitored files have change in VSCode
	//connection.console.log('We recevied an file change event');
});

connection.onDocumentSymbol((documentSymbolParams:DocumentSymbolParams): SymbolInformation[] =>{
	updatefile(documentSymbolParams.textDocument.uri);
	var symbolslist = [];
	var uri = uniformPath(documentSymbolParams.textDocument.uri);
	var luaFile:LuaFile = filesParsed[uri];
	if(luaFile) symbolslist = luaFile.symbolslist;

  	return symbolslist;
})

connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams): Location[] => {

	updatefile(textDocumentPositionParams.textDocument.uri);

	var list = [];
	var line = textDocumentPositionParams.position.line;
	var character = textDocumentPositionParams.position.character;
	var label;
	var base;

	var uri = uniformPath(textDocumentPositionParams.textDocument.uri);
	var luaFile:LuaFile = filesParsed[uri];
	if( !luaFile) return list;
	var calls = luaFile.calls;
	var luaSymbols = getLuaSymbolsRecursively(luaFile.uri);
	
	for (var i=0; i < calls.length; i++) {
	 	if (calls[i].range.start.line <= line && line <= calls[i].range.end.line)
		 {
			 if (calls[i].range.start.character <= character && character <= calls[i].range.end.character)
			 {
				 label = calls[i].label;
				 base = calls[i].base;
				 break;
			 }
		 }
	 }
	 for (var i=0; i < luaSymbols.length; i++) {
		 if (luaSymbols[i].base == base && luaSymbols[i].name == label) {
			 var loc = {
				 label:luaSymbols[i].label,
				 uri:luaSymbols[i].loc.uri,
				 range:luaSymbols[i].loc.range,
			 }
			 list.push(loc);
		 }
	 }
	 return list;
});



// This handler resolve additional information for the item selected in
// the completion list.
// connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	
// 	return item;
// });

/*
connection.onDidOpenTextDocument((params:DidOpenTextDocumentParams) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.

});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.

});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.

});
*/

// Listen on the connection
connection.listen();