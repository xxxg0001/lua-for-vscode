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
			completionProvider: {
				resolveProvider: true
			},
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


var calls = [];
var symbolslist = [];
var luaSymbols = [] ;
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	
	var textContent = change.document.getText();
	
	calls = [];
	symbolslist = [];
	luaSymbols = [];
	var uri = change.document.uri;
	
	var tb = parser.parse(textContent, {comments:false, locations:true});
  	parse2(uri, null, tb, false);
	
 });


function GetLoc(obj:any):any {

	return  {
		start:{line:obj.loc.start.line - 1,character:obj.loc.start.column},
		end:{line:obj.loc.end.line - 1,character:obj.loc.end.column}
	};
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
			calls.push(call);
			break;
		case "MemberExpression":
			if (onlydefine) {
				break;
			}
			var base = tb.base.name;
			if (base=="self" && parent != null) {
				if (parent.identifier.type == "MemberExpression") {
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
			calls.push(call);
			break;
		case "LocalStatement":
		case "AssignmentStatement":
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
			parse2(uri, parent, tb.expression, onlydefine)
			
			break;
		case "CallExpression":
			if (tb.base.name == "Include" || tb.base.name == "Require" || tb.base.name == "dofile" || tb.base.name == "require") {
				var relpath = tb.arguments[0].value
				if (relpath != null) { 
					var path1 = path.join(luapath, relpath)
					if (fs.existsSync(path1)) {
						var text = fs.readFileSync(path1);
						var uri2 = "file:///" + path1
						var tb2 = parser.parse(text.toString(), {comments:false, locations:true});
						parse2(uri2, null, tb2, true);  					
					} else if(fs.existsSync(relpath)) {
						var text = fs.readFileSync(relpath);
						var uri2 = "file:///" + relpath
						var tb2 = parser.parse(text.toString(), {comments:false, locations:true});
						parse2(uri2, null, tb2, true);
					}
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
				
				
				var symbol = {
					name: luaSymbol.label,
					location: luaSymbol.loc
				}
				
				luaSymbols.push(luaSymbol);
				symbolslist.push(symbol);
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
		case "ElseClause":
			if (tb.condition != null) {
				parse2(uri, parent, tb.condition, onlydefine);
			}
			case "Chunk":
		default:
			
			if (tb.body != null) {
				for (var i=0; i < tb.body.length; i++) {
					parse2(uri, null, tb.body[i], onlydefine);
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
}

// hold the maxNumberOfProblems setting
let luapath: string;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	
	let settings = <Settings>change.settings;
	luapath = settings.luaforvscode.luapath
	
	// Revalidate any open text documents
	
});



connection.onDidChangeWatchedFiles((change) => {
	// Monitored files have change in VSCode
	connection.console.log('We recevied an file change event');
});


// This handler provides the initial list of the completion items.
connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	// The pass parameter contains the position of the text document in 
	// which code complete got requested. For the example we ignore this
	// info and always provide the same completion items.

	return luaSymbols;
	
});

connection.onDocumentSymbol((documentSymbolParams:DocumentSymbolParams): SymbolInformation[] =>{
	

  return symbolslist;
})

connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams): Location[] => {
	var range = documents

	var list = [];
	var line = textDocumentPositionParams.position.line;
	var character = textDocumentPositionParams.position.character;
	var label;
	var base;
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
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	if (item.data === 1) {
		item.detail = 'TypeScript details',
		item.documentation = 'TypeScript documentation'
	} else if (item.data === 2) {
		item.detail = 'JavaScript details',
		item.documentation = 'JavaScript documentation'
	}  else if (item.data === 3) {
		item.detail = 'Fun details',
		item.documentation = 'Fun documentation'
	}
	return item;
});

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.uri} opened.`);
});

connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});

connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.uri} closed.`);
});
*/

// Listen on the connection
connection.listen();