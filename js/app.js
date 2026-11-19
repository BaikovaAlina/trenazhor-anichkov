/* global window, document, localStorage, location */
(function () {
  'use strict';

  const Checker = window.TrainerChecker;
  const Data = window.TrainerData;
  const Telegram = window.TelegramHomework;
  let bank;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function showToast(message, type = '') {
    document.querySelector('.toast')?.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function scoreFor(lessonId) {
    const score = Checker.getStats().lessons[lessonId] || { correct: 0, wrong: 0 };
    return { correct: score.correct, wrong: score.wrong, total: score.correct + score.wrong };
  }

  function renderHome() {
    const root = document.querySelector('#lesson-groups');
    const renderGroups = (filter = 'all') => {
      const shown = bank.lessons.filter((lesson) => filter === 'all' || lesson.module === filter);
      root.innerHTML = ['Алгебра', 'Геометрия'].filter((module) => filter === 'all' || filter === module)
        .map((module) => {
          const moduleLessons = shown.filter((lesson) => lesson.module === module);
          if (!moduleLessons.length) return '';
          return `<section><h2 class="module-title">${module}</h2><div class="lesson-grid">${moduleLessons.map((lesson) => lessonCard(lesson)).join('')}</div></section>`;
        }).join('');
    };
    renderGroups();
    const total = Checker.getStats().total;
    document.querySelector('#header-progress').textContent = total.correct + total.wrong
      ? `${total.correct} верных из ${total.correct + total.wrong}` : 'ещё нет ответов';
    document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach((item) => item.classList.remove('is-selected'));
      button.classList.add('is-selected');
      renderGroups(button.dataset.filter);
    }));
  }

  function lessonCard(lesson) {
    const level = lesson.level === 'Углублённый' ? 'advanced' : '';
    const saved = scoreFor(lesson.id);
    const progress = saved.total ? `<small class="muted">Ответов: ${saved.correct}/${saved.total} верно</small>` : '';
    return `<article class="lesson-card">
      <span class="tag ${level}">${lesson.level}</span>
      <h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.description)}</p>
      ${progress}<a class="button button-light" href="lesson.html#lesson=${encodeURIComponent(lesson.id)}">Открыть урок →</a>
    </article>`;
  }

  /**
   * Renders a task and attaches its checker. It supports text/number, choices
   * and accessible drag-and-drop matching (tap a label, then a target on touch).
   * @param {HTMLElement} host
   * @param {object} task
   * @param {{index:number,total:number,onChecked?:Function,onNext?:Function,nextLabel?:string}} options
   */
  function renderTask(host, task, options) {
    let picked = '';
    let checked = false;
    const placement = {};
    const progress = Math.round(((options.index + 1) / options.total) * 100);
    const answerHtml = task.type === 'choice' ? renderChoices(task)
      : task.type === 'drag' ? renderDrag(task)
        : `<label class="helper" for="answer">Ответ (можно дробью, например 3/4)</label><input id="answer" class="answer-input" autocomplete="off" inputmode="text" placeholder="Введите ответ">`;
    host.innerHTML = `<div class="task-top"><span class="tag">${task.type === 'drag' ? 'Сопоставление' : 'Задача'}</span><span class="task-counter">Задание ${options.index + 1} из ${options.total}</span></div>
      <div class="progress" aria-label="Прогресс"><i style="width:${progress}%"></i></div>
      <p class="question">${escapeHtml(task.prompt)}</p>
      <div class="answer-form">${answerHtml}</div>
      <div id="feedback" class="feedback" role="status"></div>
      <div class="check-row"><button id="check-answer" class="button button-primary">Проверить</button><div class="task-actions"><button id="next-task" class="button button-outline" disabled>${options.nextLabel || 'Следующая задача'} →</button></div></div>`;

    const checkButton = host.querySelector('#check-answer');
    const nextButton = host.querySelector('#next-task');
    const feedback = host.querySelector('#feedback');
    const answerInput = host.querySelector('#answer');

    host.querySelectorAll('[data-choice]').forEach((choice) => choice.addEventListener('click', () => {
      if (checked) return;
      picked = choice.dataset.choice;
      host.querySelectorAll('[data-choice]').forEach((item) => item.classList.toggle('is-picked', item === choice));
    }));

    setupDragBoard(host, task, placement, () => checked);

    const getResponse = () => {
      if (task.type === 'choice') return picked;
      if (task.type === 'drag') return placement;
      return answerInput.value;
    };

    function submit() {
      if (checked) return;
      const response = getResponse();
      const isEmpty = task.type === 'drag' ? Object.keys(response).length !== task.items.length : !String(response).trim();
      if (isEmpty) {
        showToast(task.type === 'drag' ? 'Разместите все карточки по местам.' : 'Введите или выберите ответ.', 'error');
        return;
      }
      checked = true;
      const verdict = Checker.check(task, response);
      Checker.recordAnswer(task.lessonId, verdict.correct);
      if (task.type === 'choice') {
        host.querySelectorAll('[data-choice]').forEach((item) => {
          if (item.dataset.choice === task.answer) item.classList.add('is-correct');
          else if (item.dataset.choice === picked && !verdict.correct) item.classList.add('is-wrong');
        });
      }
      checkButton.disabled = true;
      nextButton.disabled = false;
      feedback.className = `feedback show ${verdict.correct ? 'success' : 'error'}`;
      feedback.innerHTML = verdict.correct
        ? '<strong>Верно! Отличная работа.</strong> Переходите к следующей задаче.'
        : `<strong>Пока не получилось.</strong> Правильный ответ: <b>${escapeHtml(verdict.correctAnswer)}</b>. ${escapeHtml(task.explanation || '')}`;
      options.onChecked?.(verdict, task);
    }

    checkButton.addEventListener('click', submit);
    answerInput?.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
    nextButton.addEventListener('click', () => options.onNext?.());
    answerInput?.focus();
  }

  function renderChoices(task) {
    return `<p class="helper">Выберите один ответ.</p><div class="choice-list">${task.choices.map((choice) => `<button class="choice" data-choice="${escapeHtml(choice.key)}"><b>${escapeHtml(choice.key.toUpperCase())}.</b> ${escapeHtml(choice.text)}</button>`).join('')}</div>`;
  }

  function renderDrag(task) {
    return `<p class="drag-instruction">Перетащите карточку к нужному описанию. На телефоне: нажмите карточку, затем рамку.</p>
      <div class="drag-board"><div><p class="helper">Карточки</p><div class="drag-items">${task.items.map((item) => `<div class="drag-label" draggable="true" data-item="${escapeHtml(item)}">${escapeHtml(item)}</div>`).join('')}</div></div>
      <div><p class="helper">Куда поместить</p><div class="drag-targets">${task.targets.map((target) => `<div class="drop-zone" data-target="${escapeHtml(target)}"><span>${escapeHtml(target)}</span></div>`).join('')}</div></div></div>`;
  }

  function setupDragBoard(host, task, placement, isLocked) {
    if (task.type !== 'drag') return;
    const palette = host.querySelector('.drag-items');
    let selected;
    function place(item, target) {
      if (isLocked()) return;
      const card = host.querySelector(`[data-item="${CSS.escape(item)}"]`);
      const targetBox = host.querySelector(`[data-target="${CSS.escape(target)}"]`);
      if (!card || !targetBox) return;
      const existing = Object.entries(placement).find(([, value]) => value === target)?.[0];
      if (existing && existing !== item) {
        const oldCard = host.querySelector(`[data-item="${CSS.escape(existing)}"]`);
        if (oldCard) palette.append(oldCard);
        delete placement[existing];
      }
      if (placement[item] && placement[item] !== target) {
        // moving a card automatically clears its previous target
      }
      placement[item] = target;
      targetBox.append(card);
      host.querySelectorAll('.drag-label').forEach((node) => node.classList.toggle('selected', node.dataset.item === selected));
      selected = undefined;
    }
    host.querySelectorAll('.drag-label').forEach((card) => {
      card.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/plain', card.dataset.item));
      card.addEventListener('click', () => {
        if (isLocked()) return;
        selected = selected === card.dataset.item ? undefined : card.dataset.item;
        host.querySelectorAll('.drag-label').forEach((node) => node.classList.toggle('selected', node.dataset.item === selected));
      });
    });
    host.querySelectorAll('.drop-zone').forEach((zone) => {
      zone.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('is-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
      zone.addEventListener('drop', (event) => {
        event.preventDefault(); zone.classList.remove('is-over'); place(event.dataTransfer.getData('text/plain'), zone.dataset.target);
      });
      zone.addEventListener('click', () => { if (selected) place(selected, zone.dataset.target); });
    });
  }

  function renderLesson() {
    const root = document.querySelector('#main');
    const lesson = Data.lessonFromHash(bank.lessons);
    const tasks = bank.tasks.filter((task) => task.lessonId === lesson.id);
    let mode = 'class';
    let taskIndex = 0;
    const openedAt = Date.now();

    root.innerHTML = `<p class="crumbs"><a href="index.html">Все уроки</a> / ${escapeHtml(lesson.module)}</p>
      <section class="lesson-header"><div><span class="tag ${lesson.level === 'Углублённый' ? 'advanced' : ''}">${lesson.level}</span><h1>${escapeHtml(lesson.title)}</h1><p>${escapeHtml(lesson.description)}</p></div><a class="button button-light" href="trainer.html#lesson=${encodeURIComponent(lesson.id)}">Тренироваться →</a></section>
      <div class="work-tabs" role="tablist"><button class="tab is-active" data-mode="class" role="tab">Классная работа</button><button class="tab" data-mode="homework" role="tab">Домашнее задание</button></div>
      <div class="lesson-work"><section id="task-shell" class="task-shell"></section><aside><div class="side-card"><h3>Как решать?</h3><p>Не торопись: выпиши данные, выбери формулу или составь уравнение.</p><ul class="tip-list"><li>Используй черновик.</li><li>Проверь знак и единицы.</li><li>Прочитай разбор, если ошибся.</li></ul></div></aside></div>`;

    const taskHost = root.querySelector('#task-shell');
    function group() { return mode === 'class' ? tasks.slice(0, 3) : tasks.slice(3); }
    function updateTabs() {
      root.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.mode === mode));
    }
    function renderCurrent() {
      const set = group();
      if (taskIndex >= set.length) {
        renderHomeworkDone(taskHost, lesson, tasks, openedAt);
        return;
      }
      renderTask(taskHost, set[taskIndex], {
        index: taskIndex,
        total: set.length,
        nextLabel: taskIndex === set.length - 1 ? 'Завершить' : 'Следующая задача',
        onNext: () => { taskIndex += 1; renderCurrent(); }
      });
    }
    root.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
      mode = tab.dataset.mode;
      taskIndex = 0;
      updateTabs();
      renderCurrent();
    }));
    renderCurrent();
  }

  function renderHomeworkDone(host, lesson, tasks, openedAt) {
    const score = scoreFor(lesson.id);
    host.innerHTML = `<div class="homework-card"><span class="tag">Готово</span><h3>Урок завершён!</h3><p>Проверь разборы и отправь преподавателю результат. В сообщении указывается число верных ответов из всех попыток по этому уроку.</p>
      <div class="homework-summary">Результат по уроку: <b>${score.correct}/${Math.max(tasks.length, score.total)}</b></div>
      <label for="student-name">Имя ученика</label><input class="answer-input" id="student-name" placeholder="Например, Маша Иванова" value="${escapeHtml(localStorage.getItem('fizmatStudentName') || '')}">
      <button id="send-homework" class="button button-primary">Отправить результат в Telegram</button><p id="telegram-status" class="telegram-status"></p></div>`;
    setupTelegramButton({
      button: host.querySelector('#send-homework'), status: host.querySelector('#telegram-status'), nameInput: host.querySelector('#student-name'),
      lesson: lesson.title, correct: score.correct, total: Math.max(tasks.length, score.total), startedAt: openedAt
    });
  }

  function setupTelegramButton(config) {
    config.button.addEventListener('click', async () => {
      const name = config.nameInput.value.trim();
      localStorage.setItem('fizmatStudentName', name);
      config.button.disabled = true;
      config.status.className = 'telegram-status';
      config.status.textContent = 'Отправляем…';
      try {
        await Telegram.sendToTelegram({ student: name, lesson: config.lesson, correct: config.correct, total: config.total, seconds: (Date.now() - config.startedAt) / 1000 });
        config.status.className = 'telegram-status success';
        config.status.textContent = 'Готово! Результат отправлен преподавателю.';
      } catch (error) {
        config.status.className = 'telegram-status error';
        config.status.textContent = error.message || 'Не удалось отправить сообщение.';
      } finally { config.button.disabled = false; }
    });
  }

  function renderTrainer() {
    const root = document.querySelector('#main');
    const hashLesson = Data.lessonFromHash(bank.lessons);
    let selectedId = location.hash ? hashLesson.id : 'all';
    let current;
    const run = { correct: 0, wrong: 0 };
    const openedAt = Date.now();
    root.innerHTML = `<section class="trainer-heading"><div><p class="eyebrow">Практика без остановки</p><h1>Тренажёр</h1><p>Выбери тему или решай задачи вперемешку.</p></div></section>
      <section class="trainer-controls"><label for="lesson-select">Тема<select id="lesson-select"><option value="all">Все темы · случайный микс</option>${bank.lessons.map((lesson) => `<option value="${lesson.id}">${lesson.module} · ${escapeHtml(lesson.title)}</option>`).join('')}</select></label><button id="new-random" class="button button-light">Новая задача ↻</button></section>
      <div class="trainer-layout"><section id="trainer-task" class="task-shell"></section><aside class="session-panel"><h3>Эта тренировка</h3><div class="session-score"><div class="score-cell"><b id="run-good">0</b><span>верных</span></div><div class="score-cell"><b id="run-total">0</b><span>решено</span></div></div><label for="trainer-name">Имя ученика</label><input class="answer-input" id="trainer-name" placeholder="Для отправки ДЗ" value="${escapeHtml(localStorage.getItem('fizmatStudentName') || '')}"><button id="send-trainer" class="button button-primary">Отправить в Telegram</button><p id="trainer-status" class="telegram-status"></p></aside></div>`;
    const selector = root.querySelector('#lesson-select');
    selector.value = selectedId;
    const updateScore = () => {
      root.querySelector('#run-good').textContent = run.correct;
      root.querySelector('#run-total').textContent = run.correct + run.wrong;
    };
    function chooseTask() {
      const pool = selectedId === 'all' ? bank.tasks : bank.tasks.filter((task) => task.lessonId === selectedId);
      const available = pool.filter((task) => !current || task.id !== current.id);
      current = (available.length ? available : pool)[Math.floor(Math.random() * (available.length ? available.length : pool.length))];
      const lesson = bank.lessons.find((item) => item.id === current.lessonId);
      renderTask(root.querySelector('#trainer-task'), current, {
        index: 0, total: 1, nextLabel: 'Новая задача',
        onChecked: (verdict) => { run[verdict.correct ? 'correct' : 'wrong'] += 1; updateScore(); },
        onNext: chooseTask
      });
      root.querySelector('#trainer-task').insertAdjacentHTML('afterbegin', `<p class="helper">Тема: <b>${escapeHtml(lesson.title)}</b></p>`);
    }
    selector.addEventListener('change', () => { selectedId = selector.value; chooseTask(); });
    root.querySelector('#new-random').addEventListener('click', chooseTask);
    setupTrainerTelegram(root, run, openedAt, selectedId, () => selectedId);
    chooseTask();
  }

  function setupTrainerTelegram(root, run, openedAt, initialId, getSelectedId) {
    const button = root.querySelector('#send-trainer');
    const status = root.querySelector('#trainer-status');
    const nameInput = root.querySelector('#trainer-name');
    button.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      localStorage.setItem('fizmatStudentName', name);
      button.disabled = true; status.className = 'telegram-status'; status.textContent = 'Отправляем…';
      const id = getSelectedId() || initialId;
      const lessonTitle = id === 'all' ? 'Тренажёр: смешанные темы' : `Тренажёр: ${bank.lessons.find((item) => item.id === id).title}`;
      try {
        await Telegram.sendToTelegram({ student: name, lesson: lessonTitle, correct: run.correct, total: run.correct + run.wrong, seconds: (Date.now() - openedAt) / 1000 });
        status.className = 'telegram-status success'; status.textContent = 'Готово! Результат отправлен преподавателю.';
      } catch (error) { status.className = 'telegram-status error'; status.textContent = error.message || 'Не удалось отправить сообщение.'; }
      finally { button.disabled = false; }
    });
  }

  function renderStats() {
    const root = document.querySelector('#main');
    const stats = Checker.getStats();
    const total = stats.total.correct + stats.total.wrong;
    const accuracy = total ? Math.round(stats.total.correct / total * 100) : 0;
    const rows = bank.lessons.filter((lesson) => stats.lessons[lesson.id]).map((lesson) => {
      const score = stats.lessons[lesson.id];
      const attempts = score.correct + score.wrong;
      const percent = attempts ? Math.round(score.correct / attempts * 100) : 0;
      return `<tr><td><a href="lesson.html#lesson=${lesson.id}"><b>${escapeHtml(lesson.title)}</b></a></td><td>${score.correct}</td><td>${score.wrong}</td><td>${percent}%</td></tr>`;
    }).join('');
    root.innerHTML = `<p class="eyebrow">Сохраняется в этом браузере</p><h1>Моя статистика</h1><p class="intro">Это твой личный маршрут: смотри, какие темы уже получаются уверенно.</p>
      <section class="stats-grid"><div class="stat-number"><b>${stats.total.correct}</b><span>верных ответов</span></div><div class="stat-number"><b>${stats.total.wrong}</b><span>ответов с ошибкой</span></div><div class="stat-number"><b>${accuracy}%</b><span>точность</span></div></section>
      <section class="stats-card"><div class="task-top"><h2>По темам</h2><button id="reset-stats" class="button button-danger">Сбросить статистику</button></div>${rows ? `<table class="stats-table"><thead><tr><th>Тема</th><th>Верно</th><th>Ошибки</th><th>Точность</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">Пока нет ответов. <a href="trainer.html"><b>Перейти к тренажёру →</b></a></p>'}</section>`;
    root.querySelector('#reset-stats').addEventListener('click', () => {
      if (window.confirm('Удалить всю статистику на этом устройстве?')) { Checker.resetStats(); renderStats(); }
    });
  }

  async function init() {
    try {
      bank = await Data.load();
      const page = document.body.dataset.page;
      if (page === 'home') renderHome();
      if (page === 'lesson') { renderLesson(); window.addEventListener('hashchange', renderLesson); }
      if (page === 'trainer') renderTrainer();
      if (page === 'stats') renderStats();
    } catch (error) {
      document.querySelector('#main, #lesson-groups').innerHTML = `<p class="empty">Не удалось загрузить задания. ${escapeHtml(error.message || '')}</p>`;
    }
  }
  init();
}());
