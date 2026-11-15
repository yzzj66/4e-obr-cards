// 兼容旧缓存用的垫片（真正的后台逻辑在 background.core.js + background.bundle.js）。
//
// 曾经 background.html 引用的是这个文件（ESM、import common.js）。现在后台页只加载
// assets/background.bundle.js —— 一个不带 type="module"、没有 import/export 的单文件脚本，
// 避免任何模块加载策略带来的风险。
//
// 保留本文件只为一种情况：浏览器缓存了旧版 background.html，仍在请求 assets/background.js。
// 这时它会把真正的 bundle 注入进来，让旧缓存也能自愈。
(function () {
  var src = "assets/background.bundle.js";
  try { src = new URL("assets/background.bundle.js", location.href).href; } catch (e) { /* 忽略 */ }
  try {
    var s = document.createElement("script");
    s.src = src;
    s.onerror = function () {
      try { console.error("[4enext] 兼容垫片加载 background.bundle.js 失败：" + src); } catch (e) { /* 忽略 */ }
    };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) { /* 忽略 */ }
})();
