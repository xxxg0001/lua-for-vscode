# lua for vscode

Together to improve this extension [GitHub](https://github.com/GCCFeli/vscode-lua/issues).

# Features  
support lua4.x upvalue  
Goto Definition (only function )  
List Document Symbols (now only list function)  


# Set your lua path
if you want find defintion from other files, you need set the lua path to workspace settings

workspace settings
```
{
    "luaforvscode.luapath":"C:\\Project"
} 
```

test1.lua
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



#Change Log  

Version 0.0.8
support find definition from luapath
