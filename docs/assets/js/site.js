(function () {
  var root = document.documentElement;
  var toggle = document.querySelector("[data-theme-toggle]");

  function setTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  var content = document.querySelector("[data-content]");
  var toc = document.querySelector("[data-toc]");
  if (!content || !toc) return;

  var headings = Array.prototype.slice.call(content.querySelectorAll("h2, h3"));
  if (!headings.length) {
    toc.parentElement.classList.add("is-empty");
    return;
  }

  var used = {};
  function slugify(text) {
    var slug = text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");
    slug = slug || "section";
    used[slug] = (used[slug] || 0) + 1;
    return used[slug] === 1 ? slug : slug + "-" + used[slug];
  }

  var list = document.createElement("ol");
  headings.forEach(function (heading) {
    if (!heading.id) heading.id = slugify(heading.textContent);
    var item = document.createElement("li");
    var link = document.createElement("a");
    link.href = "#" + heading.id;
    link.textContent = heading.textContent;
    link.className = "toc-" + heading.tagName.toLowerCase();
    item.appendChild(link);
    list.appendChild(item);
  });
  toc.appendChild(list);

  if (!("IntersectionObserver" in window)) return;

  var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          link.classList.toggle("active", link.hash === "#" + entry.target.id);
        });
      });
    },
    { rootMargin: "0px 0px -70% 0px", threshold: 0.1 }
  );

  headings.forEach(function (heading) {
    observer.observe(heading);
  });
})();
