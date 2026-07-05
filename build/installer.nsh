!include nsDialogs.nsh

Var CheckboxContextMenu
Var CheckboxDefaultApp
Var CheckboxContextMenu_State
Var CheckboxDefaultApp_State

Function CustomOptionsPage
  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 0 100% 20u "请选择需要启用的功能："
  Pop $0

  ${NSD_CreateCheckbox} 10u 30u 100% 15u "添加到右键菜单（右键 .md 文件可直接打开）"
  Pop $CheckboxContextMenu
  ${NSD_Check} $CheckboxContextMenu

  ${NSD_CreateCheckbox} 10u 55u 100% 15u "设为 .md 文件的默认打开应用"
  Pop $CheckboxDefaultApp

  nsDialogs::Show
FunctionEnd

Function CustomOptionsPageLeave
  ${NSD_GetState} $CheckboxContextMenu $CheckboxContextMenu_State
  ${NSD_GetState} $CheckboxDefaultApp $CheckboxDefaultApp_State
FunctionEnd

!macro customHeader
  Page custom CustomOptionsPage CustomOptionsPageLeave
!macroend

!macro customInstall
  ${If} $CheckboxContextMenu_State == ${BST_CHECKED}
    WriteRegStr HKCR "SystemFileAssociations\.md\shell\MarkdownEditor" "" "用 Markdown Editor 打开"
    WriteRegStr HKCR "SystemFileAssociations\.md\shell\MarkdownEditor" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    WriteRegStr HKCR "SystemFileAssociations\.md\shell\MarkdownEditor\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  ${EndIf}

  ${If} $CheckboxDefaultApp_State == ${BST_CHECKED}
    WriteRegStr HKCR ".md" "" "MarkdownEditor.File"
    WriteRegStr HKCR "MarkdownEditor.File" "" "Markdown 文档"
    WriteRegStr HKCR "MarkdownEditor.File\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
    WriteRegStr HKCR "MarkdownEditor.File\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  ${EndIf}
!macroend

!macro customUnInstall
  DeleteRegKey HKCR "SystemFileAssociations\.md\shell\MarkdownEditor"
  DeleteRegKey HKCR "MarkdownEditor.File"
  ReadRegStr $0 HKCR ".md" ""
  ${If} $0 == "MarkdownEditor.File"
    DeleteRegValue HKCR ".md" ""
  ${EndIf}
!macroend
