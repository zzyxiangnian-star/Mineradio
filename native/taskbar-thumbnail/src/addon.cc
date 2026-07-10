#include <napi.h>
#include <windows.h>
#include <dwmapi.h>
#include <commctrl.h>

#include <algorithm>
#include <cstring>
#include <mutex>
#include <vector>

namespace {

constexpr UINT_PTR kSubclassId = 0x4D525442;

struct ThumbnailState {
  HWND hwnd = nullptr;
  std::vector<unsigned char> pixels;
  int width = 0;
  int height = 0;
  bool attached = false;
  std::mutex mutex;
};

ThumbnailState g_state;

HBITMAP CreateScaledBitmap(
    const std::vector<unsigned char>& pixels,
    int source_width,
    int source_height,
    int target_width,
    int target_height) {
  if (pixels.empty() || source_width < 1 || source_height < 1 ||
      target_width < 1 || target_height < 1) {
    return nullptr;
  }

  BITMAPINFO destination_info{};
  destination_info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  destination_info.bmiHeader.biWidth = target_width;
  destination_info.bmiHeader.biHeight = -target_height;
  destination_info.bmiHeader.biPlanes = 1;
  destination_info.bmiHeader.biBitCount = 32;
  destination_info.bmiHeader.biCompression = BI_RGB;

  void* destination_bits = nullptr;
  HDC screen = GetDC(nullptr);
  if (!screen) return nullptr;

  HBITMAP bitmap = CreateDIBSection(
      screen,
      &destination_info,
      DIB_RGB_COLORS,
      &destination_bits,
      nullptr,
      0);
  HDC memory = CreateCompatibleDC(screen);
  if (!bitmap || !memory || !destination_bits) {
    if (memory) DeleteDC(memory);
    if (bitmap) DeleteObject(bitmap);
    ReleaseDC(nullptr, screen);
    return nullptr;
  }

  HGDIOBJ previous = SelectObject(memory, bitmap);
  SetStretchBltMode(memory, HALFTONE);
  SetBrushOrgEx(memory, 0, 0, nullptr);

  BITMAPINFO source_info{};
  source_info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  source_info.bmiHeader.biWidth = source_width;
  source_info.bmiHeader.biHeight = -source_height;
  source_info.bmiHeader.biPlanes = 1;
  source_info.bmiHeader.biBitCount = 32;
  source_info.bmiHeader.biCompression = BI_RGB;

  int copied = StretchDIBits(
      memory,
      0,
      0,
      target_width,
      target_height,
      0,
      0,
      source_width,
      source_height,
      pixels.data(),
      &source_info,
      DIB_RGB_COLORS,
      SRCCOPY);

  SelectObject(memory, previous);
  DeleteDC(memory);
  ReleaseDC(nullptr, screen);

  if (copied == GDI_ERROR) {
    DeleteObject(bitmap);
    return nullptr;
  }
  return bitmap;
}

LRESULT CALLBACK ThumbnailSubclassProc(
    HWND hwnd,
    UINT message,
    WPARAM w_param,
    LPARAM l_param,
    UINT_PTR,
    DWORD_PTR) {
  if (message == WM_DWMSENDICONICTHUMBNAIL) {
    const int target_width = std::max(1, static_cast<int>(HIWORD(l_param)));
    const int target_height = std::max(1, static_cast<int>(LOWORD(l_param)));
    std::vector<unsigned char> pixels;
    int width = 0;
    int height = 0;
    {
      std::lock_guard<std::mutex> lock(g_state.mutex);
      pixels = g_state.pixels;
      width = g_state.width;
      height = g_state.height;
    }

    HBITMAP bitmap = CreateScaledBitmap(
        pixels,
        width,
        height,
        target_width,
        target_height);
    if (bitmap) {
      HRESULT result = DwmSetIconicThumbnail(
          hwnd,
          bitmap,
          DWM_SIT_DISPLAYFRAME);
      DeleteObject(bitmap);
      if (SUCCEEDED(result)) return 0;
    }
  } else if (message == WM_NCDESTROY) {
    RemoveWindowSubclass(hwnd, ThumbnailSubclassProc, kSubclassId);
    std::lock_guard<std::mutex> lock(g_state.mutex);
    g_state.hwnd = nullptr;
    g_state.pixels.clear();
    g_state.width = 0;
    g_state.height = 0;
    g_state.attached = false;
  }

  return DefSubclassProc(hwnd, message, w_param, l_param);
}

Napi::Boolean BooleanResult(Napi::Env env, bool value) {
  return Napi::Boolean::New(env, value);
}

Napi::Value Attach(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsBuffer()) {
    return BooleanResult(env, false);
  }

  auto buffer = info[0].As<Napi::Buffer<unsigned char>>();
  if (buffer.Length() < sizeof(HWND)) return BooleanResult(env, false);

  HWND hwnd = nullptr;
  std::memcpy(&hwnd, buffer.Data(), sizeof(HWND));
  if (!IsWindow(hwnd)) return BooleanResult(env, false);

  {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    if (g_state.attached && g_state.hwnd == hwnd) return BooleanResult(env, true);
    if (g_state.attached) return BooleanResult(env, false);
  }

  if (!SetWindowSubclass(hwnd, ThumbnailSubclassProc, kSubclassId, 0)) {
    return BooleanResult(env, false);
  }

  BOOL enabled = TRUE;
  HRESULT force = DwmSetWindowAttribute(
      hwnd,
      DWMWA_FORCE_ICONIC_REPRESENTATION,
      &enabled,
      sizeof(enabled));
  HRESULT iconic_bitmap = DwmSetWindowAttribute(
      hwnd,
      DWMWA_HAS_ICONIC_BITMAP,
      &enabled,
      sizeof(enabled));
  if (FAILED(force) || FAILED(iconic_bitmap)) {
    RemoveWindowSubclass(hwnd, ThumbnailSubclassProc, kSubclassId);
    enabled = FALSE;
    DwmSetWindowAttribute(
        hwnd,
        DWMWA_FORCE_ICONIC_REPRESENTATION,
        &enabled,
        sizeof(enabled));
    DwmSetWindowAttribute(
        hwnd,
        DWMWA_HAS_ICONIC_BITMAP,
        &enabled,
        sizeof(enabled));
    return BooleanResult(env, false);
  }

  {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    g_state.hwnd = hwnd;
    g_state.attached = true;
  }
  DwmInvalidateIconicBitmaps(hwnd);
  return BooleanResult(env, true);
}

Napi::Value UpdateBitmap(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsBuffer() ||
      !info[1].IsNumber() || !info[2].IsNumber()) {
    return BooleanResult(env, false);
  }

  auto buffer = info[0].As<Napi::Buffer<unsigned char>>();
  int width = info[1].As<Napi::Number>().Int32Value();
  int height = info[2].As<Napi::Number>().Int32Value();
  if (width < 1 || height < 1 || width > 4096 || height > 4096) {
    return BooleanResult(env, false);
  }

  size_t expected =
      static_cast<size_t>(width) * static_cast<size_t>(height) * 4u;
  if (buffer.Length() != expected) return BooleanResult(env, false);

  HWND hwnd = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    if (!g_state.attached || !IsWindow(g_state.hwnd)) {
      return BooleanResult(env, false);
    }
    g_state.pixels.assign(buffer.Data(), buffer.Data() + buffer.Length());
    g_state.width = width;
    g_state.height = height;
    hwnd = g_state.hwnd;
  }

  return BooleanResult(env, SUCCEEDED(DwmInvalidateIconicBitmaps(hwnd)));
}

Napi::Value ClearBitmap(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  HWND hwnd = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    g_state.pixels.clear();
    g_state.width = 0;
    g_state.height = 0;
    hwnd = g_state.hwnd;
  }
  if (hwnd && IsWindow(hwnd)) DwmInvalidateIconicBitmaps(hwnd);
  return BooleanResult(env, true);
}

Napi::Value Detach(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  HWND hwnd = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    if (!g_state.attached) return BooleanResult(env, true);
    hwnd = g_state.hwnd;
    g_state.hwnd = nullptr;
    g_state.pixels.clear();
    g_state.width = 0;
    g_state.height = 0;
    g_state.attached = false;
  }

  if (hwnd && IsWindow(hwnd)) {
    RemoveWindowSubclass(hwnd, ThumbnailSubclassProc, kSubclassId);
    BOOL disabled = FALSE;
    DwmSetWindowAttribute(
        hwnd,
        DWMWA_FORCE_ICONIC_REPRESENTATION,
        &disabled,
        sizeof(disabled));
    DwmSetWindowAttribute(
        hwnd,
        DWMWA_HAS_ICONIC_BITMAP,
        &disabled,
        sizeof(disabled));
    DwmInvalidateIconicBitmaps(hwnd);
  }
  return BooleanResult(env, true);
}

}  // namespace

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("attach", Napi::Function::New(env, Attach));
  exports.Set("updateBitmap", Napi::Function::New(env, UpdateBitmap));
  exports.Set("clearBitmap", Napi::Function::New(env, ClearBitmap));
  exports.Set("detach", Napi::Function::New(env, Detach));
  return exports;
}

NODE_API_MODULE(taskbar_thumbnail, Init)
