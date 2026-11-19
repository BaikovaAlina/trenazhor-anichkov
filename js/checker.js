/* global window, localStorage */
(function () {
  'use strict';

  const STORAGE_KEY = 'fizmatTrainerStatsV1';

  /**
   * Converts a student entry into a comparable form. Commas, extra spaces,
   * multiplication signs and common Unicode variants do not affect an answer.
   * @param {unknown} value student answer
   * @returns {string} normalized answer
   */
  function normalize(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/,/g, '.')
      .replace(/[−–—]/g, '-')
      .replace(/[×·*]/g, '')
      .replace(/\s+/g, '')
      .replace(/√/g, 'sqrt')
      .replace(/π/g, 'pi');
  }

  /**
   * Parses a number, a decimal comma notation or a simple fraction (e.g. 3/4).
   * It deliberately rejects expressions such as 2+2: pupils should enter an answer.
   * @param {unknown} value
   * @returns {number|null}
   */
  function parseNumber(value) {
    const text = normalize(value);
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return Number(text);
    const fraction = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\/([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
    if (fraction) {
      const denominator = Number(fraction[2]);
      return denominator === 0 ? null : Number(fraction[1]) / denominator;
    }
    return null;
  }

  /**
   * Checks any answer type used in data/tasks.json.
   * Numeric answers are accepted with a tolerance or as equivalent fractions.
   * @param {object} task task object
   * @param {string|object} received answer from UI
   * @returns {{correct:boolean, message:string, correctAnswer:string}}
   */
  function check(task, received) {
    if (task.type === 'drag') {
      const actual = received || {};
      const keys = Object.keys(task.answer || {});
      const correct = keys.length > 0 && keys.every((key) => actual[key] === task.answer[key]);
      return result(task, correct);
    }

    const expectedNumber = parseNumber(task.answer);
    const receivedNumber = parseNumber(received);
    let correct;
    if (expectedNumber !== null && receivedNumber !== null) {
      correct = Math.abs(expectedNumber - receivedNumber) <= (Number(task.tolerance) || 0.01);
    } else {
      correct = normalize(received) === normalize(task.answer);
    }
    return result(task, correct);
  }

  function result(task, correct) {
    return {
      correct,
      correctAnswer: formatAnswer(task.answer),
      message: correct
        ? 'Верно! Отличная работа.'
        : `Пока не получилось. Правильный ответ: ${formatAnswer(task.answer)}. ${task.explanation || ''}`
    };
  }

  function formatAnswer(answer) {
    if (answer && typeof answer === 'object') return 'проверьте соответствия';
    return String(answer).replace(/sqrt/g, '√');
  }

  function blankStats() {
    return {
      version: 1,
      createdAt: Date.now(),
      total: { correct: 0, wrong: 0 },
      lessons: {},
      session: { startedAt: Date.now(), correct: 0, wrong: 0 }
    };
  }

  /** @returns {object} progress from localStorage, never throws for bad data. */
  function getStats() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && data.version === 1) return data;
    } catch (_) { /* reset malformed storage below */ }
    return blankStats();
  }

  function saveStats(stats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    return stats;
  }

  /**
   * Saves a checked task in statistics. The caller keeps each question locked,
   * so one visible attempt is counted only once.
   * @param {string} lessonId
   * @param {boolean} correct
   */
  function recordAnswer(lessonId, correct) {
    const stats = getStats();
    const field = correct ? 'correct' : 'wrong';
    stats.total[field] += 1;
    stats.session[field] += 1;
    if (!stats.lessons[lessonId]) stats.lessons[lessonId] = { correct: 0, wrong: 0, updatedAt: 0 };
    stats.lessons[lessonId][field] += 1;
    stats.lessons[lessonId].updatedAt = Date.now();
    return saveStats(stats);
  }

  function resetStats() {
    localStorage.removeItem(STORAGE_KEY);
    return blankStats();
  }

  window.TrainerChecker = { normalize, parseNumber, check, getStats, recordAnswer, resetStats, STORAGE_KEY };
}());
