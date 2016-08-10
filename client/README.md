# lua for vscode

Together to improve this extension [GitHub](https://github.com/xxxg0001/lua-for-vscode).

# Features  
support lua4.x upvalue  
Goto Definition (only function )  
List Document Symbols (now only list function)



# Set your lua path and include keyword
if you want find defintion from other files, you need set the lua path to workspace settings  
file search $luapath/ , $workspaceroot/, ./  
workspace settings
```
{
    "luaforvscode.luapath":"C:\\Project"
    "luaforvscode.includekeyword":"Include,Require,require,dofile,include"
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

Version 0.0.11  
fixed bug: can't go to definition by if else body
support custom define include keyword
add search path

Version 0.0.8
support find definition from luapath
