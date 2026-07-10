{
  "variables": {
    "clang": 0
  },
  "targets": [
    {
      "target_name": "taskbar_thumbnail",
      "sources": ["src/addon.cc"],
      "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "UNICODE",
        "_UNICODE",
        "_WIN32_WINNT=0x0601"
      ],
      "libraries": ["dwmapi.lib", "comctl32.lib", "gdi32.lib"]
    }
  ]
}
