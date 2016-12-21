Version 0.0.23  
reduce disturbing user  
change lua error from vscode.windows to output( view->output)  
parsing script when frist time go to definition or show symbol  
parsing script when save document

Version 0.0.22  
fixed some error  
restore find 'self' on anonymous function  

Version 0.0.19  
Supports multiple lua paths  
skip find 'self' on anonymous function (temporary)  

Version 0.0.18  
show lua script error to vscode.windows  

Version 0.0.17    
only parsing script when go to definition or show symbol  

Version 0.0.16  
fixed bugs  
add config for lua version to solve lua4.x parsing  

Version 0.0.13  
fixed bug:open more than one files sometime goto definition fail  
Goto Definition support some variable  
search path modify to ?, ?.lua, $luapath/?,$luapath/?.lua, $workspaceroot/?, $workspaceroot/?.lua  

Version 0.0.11  
fixed bug: can't go to definition by if else body
support custom define include keyword
add search path

Version 0.0.8
support find definition from luapath