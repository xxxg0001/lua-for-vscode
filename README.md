# lua for vscode

Together to improve this extension [GitHub](https://github.com/xxxg0001/lua-for-vscode).

# Features  
support lua4.x upvalue   
Goto Definition (function and some variable)  
List Document Symbols (now only list function)

# About lua version
### default for lua 5.x  
### if you use 4.x need set luaforvscode.luaversion to 4    

# Set your lua path and include keyword
if you want find defintion from other files, you need set the lua path to workspace settings  
file search ?, ?.lua, $luapath/?,$luapath/?.lua, $workspaceroot/?, $workspaceroot/?.lua  
workspace settings  
```
{
    "luaforvscode.luapath":"C:\\Project;C:\\luapath2",
    "luaforvscode.includekeyword":"Include,Require,require,dofile,include",
    "luaforvscode.luaversion":4
} 
```

test1.lua  
here search $luapath/script/test2.lua, $workspaceroot/script/test2.lua, /script/test2.lua
 ```
Include("\\script\\test2.lua") --or Require("\\script\\test2.lua") or dofile("\\script\\test2.lua") later you can custom this keyword 
main()
```

test2.lua
 ```
function main()
end
```
![Goto Definition](https://github.com/xxxg0001/lua-for-vscode/blob/master/screenshot/screenshot2.jpg?raw=true)  


# Example

![List Document Symbols](https://github.com/xxxg0001/lua-for-vscode/blob/master/screenshot/screenshot1.png?raw=true)  

![Goto Definition](https://github.com/xxxg0001/lua-for-vscode/blob/master/screenshot/screenshot3.png?raw=true)    

# Issue  
not support this case now, because hard to know what's type tbsub and the type of tb.new return  
if you have a solution please tell me, thanks  

```
tb = {}
function tb:new()
    return tb
end
function tb:dofunc()
end

tbsub = tb:new()

tbsub:dofunc()
```

# Change Log  
Version 0.0.23  
reduce disturbing user  
change lua error from vscode.windows to output( view->output)  
parsing script when frist time go to definition or show symbol  
parsing script when save document  
