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
	var tb = parser.parse(textContent, {comments:false, locations:true, ranges:true, scope:true});
 	parse2(uri, null, tb);
	
 });


function GetLoc(obj:any):any {

	return  {
		start:{line:obj.loc.start.line - 1,character:obj.loc.start.column},
		end:{line:obj.loc.end.line - 1,character:obj.loc.end.column}
	};
}

function ParseCallExpression(parent:any, tb:any) {
	
	switch (tb.base.type) {
		case "Identifier":
			var name = tb.base.name;
			var call = {
				base: null,
				label:name,
				range:GetLoc(tb.base)
			}
			calls.push(call);
			break;
		case "MemberExpression":
			var base = tb.base.base.name;
			if (base=="self" && parent != null) {
				if (parent.identifier.type == "MemberExpression") {
					base = parent.identifier.base.name						
				}
			}
			var name = tb.base.identifier.name;
			var call = {
				base: base,
				label:name,
				range:GetLoc(tb.base.identifier)
			}
			calls.push(call);
			break;
	}
}		



function parse2(uri:string, parent:any, tb:any) {
	switch (tb.type) {
		case "LocalStatement":
		case "AssignmentStatement":
			if (tb.init != null) {
				for (var i=0; i < tb.init.length; i++) {
					parse2(uri, parent, tb.init[i]);
				}
			}
			break;
		case "TableConstructorExpression":
			if (tb.fields != null) {
				for (var i=0; i < tb.fields.length; i++) {
					parse2(uri, parent, tb.fields[i]);
				}
			}
			break;
		case "TableKeyString":
		case "TableKey":
			if (tb.value != null) {
				parse2(uri, parent, tb.value);
			}
			break;
		case "Chunk":
			if (tb.body != null) {
				for (var i=0; i < tb.body.length; i++) {
					parse2(uri, null, tb.body[i]);
				}
			}
			break;
		case "IfStatement":
			if (tb.clauses != null) {
				for (var i=0; i < tb.clauses.length; i++) {
					parse2(uri, parent, tb.clauses[i]);
				}
			}
			break;
		case "IfClause":
		case "ElseifClause":
			if (tb.condition != null) {
				parse2(uri, parent, tb.condition);
			}
		case "ElseClause":
			if (tb.body != null) {
				for (var i=0; i < tb.body.length; i++) {
					parse2(uri, parent, tb.body[i]);
				}
			}
			break;
		case "ForNumericStatement":
		case "ForGenericStatement":
			if (tb.body != null) {
				for (var i=0; i < tb.body.length; i++) {
					parse2(uri, parent, tb.body[i]);
				}
			}
			break;
		case "ReturnStatement":
			if (tb.arguments != null) {
				for (var i=0; i < tb.arguments.length; i++) {
					parse2(uri, parent, tb.arguments[i]);
				}
			}
			break;
		case "CallStatement":
			parse2(uri, parent, tb.expression)
			
			break;
		case "CallExpression":
			ParseCallExpression(parent, tb)
			if (tb.arguments != null) {
				for (var i=0; i < tb.arguments.length; i++) {
					parse2(uri, parent, tb.arguments[i]);
				}
			}
			break;
		case "FunctionDeclaration":
			var luaSymbol = new LuaSymbol;
			luaSymbol.type = tb.type;
			luaSymbol.name = tb.identifier.base.name;
			
			
			if (tb.identifier.type == "MemberExpression") {
				luaSymbol.base = tb.identifier.base.name
				luaSymbol.name = tb.identifier.identifier.name;
				
			}
			luaSymbol.loc = {
				uri:uri,
				range:GetLoc(tb)
			};
			
			var fun = {
				uri:uri, 
				label:luaSymbol.name,
				range:luaSymbol.loc.uri,
				documentation:tb.parameters.toString()
			}
			
			var symbol = {
				name: luaSymbol.label,
				location: luaSymbol.loc
			}
			
			luaSymbols.push(luaSymbol);
			symbolslist.push(symbol);			
			
			if (tb.body != null) {
				for (var i=0; i < tb.body.length; i++) {
					parse2(uri, tb, tb.body[i]);
					
				}
			}
			break;
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

	return luaSymbols;
	
});

connection.onDocumentSymbol((documentSymbolParams:DocumentSymbolParams): SymbolInformation[] =>{
	

  return symbolslist;
})

connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams): Location[] => {
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