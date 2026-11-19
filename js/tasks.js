/* global window, fetch */
(function () {
  'use strict';
  let cache;

  /**
   * Loads the editable JSON bank once for every open page.
   * @returns {Promise<{lessons:Array, tasks:Array}>}
   */
  async function load() {
    if (cache) return cache;
    cache = Promise.all([
      fetch('data/lessons.json').then(assertOk).then((response) => response.json()),
      fetch('data/tasks.json').then(assertOk).then((response) => response.json())
    ]).then(([lessons, tasks]) => ({ lessons, tasks }));
    return cache;
  }

  function assertOk(response) {
    if (!response.ok) throw new Error(`Не удалось загрузить банк заданий (${response.status}).`);
    return response;
  }

  function lessonFromHash(lessons) {
    const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
    const id = raw.startsWith('lesson=') ? raw.slice(7) : raw;
    return lessons.find((lesson) => lesson.id === id) || lessons[0];
  }

  window.TrainerData = { load, lessonFromHash };
}());
