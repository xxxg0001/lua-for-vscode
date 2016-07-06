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


var parser  = require('luaparse');



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

var funslist = [];
var calls = [];
var symbols = [];
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	
	var textContent = change.document.getText();
	funslist = [];
	calls = [];
	symbols = [];
	var uri = change.document.uri;
	var tb = parser.parse(textContent, {comments:false, locations:true, ranges:true, scope:true});
 	parse2(uri, tb);
	
 });



function parse2(uri:string, tb:any) {
	for (var i=0; i < tb.body.length; i++) {
		if (tb.body[i].type=="FunctionDeclaration") {
			var name = tb.body[i].identifier.name; 
			if (tb.body[i].identifier.type == "MemberExpression") {
				name = tb.body[i].identifier.base.name + tb.body[i].identifier.indexer + tb.body[i].identifier.identifier.name;
			}
			var fun = {
				uri:uri, 
				label:name,
				range:{
					start:{line:tb.body[i].loc.start.line - 1,character:tb.body[i].loc.start.column},
					end:{line:tb.body[i].loc.end.line - 1,character:tb.body[i].loc.end.column}
				},
				documentation:tb.body[i].parameters.toString()
			}
			var symbol = {
				name: name,
				location: {
					 uri: uri,
					 range:{
						start:{line:tb.body[i].loc.start.line - 1,character:tb.body[i].loc.start.column},
						end:{line:tb.body[i].loc.end.line - 1,character:tb.body[i].loc.end.column}
					},
				}
			}
			symbols.push(symbol);			
			funslist.push(fun);
			parse2(uri, tb.body[i]);
		} else if (tb.body[i].type=="CallStatement") {
			var call = {
				label:tb.body[i].expression.base.name,
				range:{
					start:{line:tb.body[i].expression.base.loc.start.line - 1,character:tb.body[i].expression.base.loc.start.column},
					end:{line:tb.body[i].expression.base.loc.end.line - 1,character:tb.body[i].expression.base.loc.end.column}
				}
			}
			calls.push(call);
		} else if (tb.body[i].type=="IfStatement") {
			
			parse2(uri, tb.body[i].clauses[i]);
		}
		
	}
}
// The settings interface describe the server relevant settings part
interface Settings {
	languageServerExample: ExampleSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// hold the maxNumberOfProblems setting
let maxNumberOfProblems: number;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	let settings = <Settings>change.settings;
	maxNumberOfProblems = settings.languageServerExample.maxNumberOfProblems || 100;
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

	return funslist;
	
});

connection.onDocumentSymbol((documentSymbolParams:DocumentSymbolParams): SymbolInformation[] =>{
	

  return symbols;
})

connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams): Location[] => {
	var list = [];
	var line = textDocumentPositionParams.position.line;
	var character = textDocumentPositionParams.position.character;
	var label;
	for (var i=0; i < calls.length; i++) {
	 	if (calls[i].range.start.line <= line && line <= calls[i].range.end.line)
		 {
			 if (calls[i].range.start.character <= character && character <= calls[i].range.end.character)
			 {
				 label = calls[i].label;
				 break;
			 }
		 }
	 }
	 for (var i=0; i < funslist.length; i++) {
		 if (funslist[i].label == label) {
			 list.push(funslist[i]);
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