; installer.nsh — personalizaciones del instalador Ziron Engine

!macro customWelcomePage
  ; Página de bienvenida personalizada
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customLicensePage
  ; Muestra LICENSE en el instalador
  !insertmacro MUI_PAGE_LICENSE "LICENSE"
!macroend