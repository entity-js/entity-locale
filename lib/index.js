/**
 *  ____            __        __
 * /\  _`\         /\ \__  __/\ \__
 * \ \ \L\_\    ___\ \ ,_\/\_\ \ ,_\  __  __
 *  \ \  _\L  /' _ `\ \ \/\/\ \ \ \/ /\ \/\ \
 *   \ \ \L\ \/\ \/\ \ \ \_\ \ \ \ \_\ \ \_\ \
 *    \ \____/\ \_\ \_\ \__\\ \_\ \__\\/`____ \
 *     \/___/  \/_/\/_/\/__/ \/_/\/__/ `/___/> \
 *                                        /\___/
 *                                        \/__/
 *
 * Entity Core
 */

/**
 * Provides the locale manager.
 *
 * @author Orgun109uk <orgun109uk@gmail.com>
 */

var path = require('path'),
    glob = require('glob'),
    async = require('async');

/**
 * The Locale class provides functionality for storing translation strings and
 * translating a given string.
 *
 * @class
 * @param {Database} database The database manager.
 */
function Locale(core) {
  'use strict';

  var locales = {};

  Object.defineProperties(this, {
    /**
     * Get the defined locales.
     *
     * @var {Object} _locales
     * @memberof Locale
     * @private
     * @instance
     */
    _locales: {
      get: function () {
        return locales;
      }
    },
    /**
     * Get the defined language names.
     *
     * @var {Array} languages
     * @memberof Locale
     * @readonly
     * @instance
     */
    languages: {
      get: function () {
        return Object.keys(locales);
      }
    },
    /**
     * Get the owning entity core object.
     *
     * @var {EntityCore} core
     * @memberof Locale
     * @readonly
     * @instance
     */
    core: {
      value: core
    }
  });
}

/**
 * Add translations stored in the database.
 *
 * @param {Function} done The done callback.
 * @param {Error} done.err Any raised errors.
 * @private
 */
Locale.prototype._addFromDatabase = function (done) {
  'use strict';

  var me = this;
  this.core.database.collection('locales').find(function (err, docs) {
    if (err) {
      return done(err);
    }

    docs.forEach(function (doc) {
      if (me._locales[doc.language] === undefined) {
        me._locales[doc.language] = {};
      }

      me._locales[doc.language][doc.msg] = doc.translation;
    });

    done(null);
  });
};

/**
 * Processes the given JSON filename.
 *
 * @param {String} filename The translation file filename, note that it must
 *   be in the format *.LANGUAGE.json.
 * @param {Function} done The done callback.
 * @param {Error} done.err Any raised errors.
 * @private
 */
Locale.prototype._processFile = function (filename, done) {
  'use strict';

  try {
    var locale = require(filename),
        language = filename.split('.')[1];

    if (this._locales[language] === undefined) {
      this._locales[language] = {};
    }

    for (var msg in locale) {
      if (this._locales[language][msg]) {
        continue;
      }

      this._locales[language][msg] = locale[msg];
    }

    done(null);
  } catch (err) {
    done(err);
  }
};

/**
 * Perform token string replacement, this is based upon the PHP.js strtr
 * script.
 *
 * @param {String} str The string to replace.
 * @param {Object} params The token params.
 * @return {String} The replaced string.
 * @private
 */
Locale.prototype._strtr = function (str, params) {
  'use strict';

  var i, len,
      j, frm,
      from = [],
      to = [],
      ret = '',
      match = false;

  for (var arg in params) {
    from.push(':' + arg);
    to.push(params[arg]);
  }

  for (i = 0, len = str.length; i < len; i++) {
    match = false;
    for (j = 0, frm = from.length; j < frm; j++) {
      if (str.substr(i, from[j].length) === from[j]) {
        match = true;
        i = (i + from[j].length) - 1;

        break;
      }
    }

    ret += match ? to[j] : str.charAt(i);
  }

  return ret;
};

/**
 * Add translations from a JSON file.
 *
 * @param {String} filename The translation file filename, note that it must
 *   be in the format *.LANGUAGE.json.
 * @param {Function} done The done callback.
 * @param {Error} done.err Any raised errors.
 */
Locale.prototype.addFromFile = function (filename, done) {
  'use strict';

  this._processFile(filename, done);
};

/**
 * Add translation files from the given directory.
 *
 * @param {String} dir The directory to scan.
 * @param {Function} done The done callback.
 * @param {Error} done.err Any raised errors.
 */
Locale.prototype.addFromDir = function (dir, done) {
  'use strict';

  var me = this;

  function processFile(filename) {
    return function (next) {
      me.addFromFile(filename, next);
    };
  }

  glob(path.join(dir, '**', '*.json'), function (err, files) {
    if (err) {
      return done(err);
    }

    var queue = [];
    files.forEach(function (item) {
      var splt = item.split('.');
      if (splt.length === 3 && splt[1].length === 2) {
        queue.push(processFile(item));
      }
    });

    async.series(queue, function (err) {
      done(err ? err : null);
    });
  });
};

/**
 * Returns all defined translations for the given language.
 *
 * @param {String} language The language to return.
 * @return {Object} An object containing the translation strings.
 * @throws {Error} If the language is undefined.
 */
Locale.prototype.locales = function (language) {
  'use strict';

  if (this._locales[language] === undefined) {
    throw new Error(); // @todo
  }

  return this._locales[language];
};

/**
 * Initializes the locale, collection translations from the database and
 * provided directory.
 *
 * @param {String} dir The directory to read from.
 * @param {Function} done The done callback.
 * @param {Error} done.err Any raised errors.
 */
Locale.prototype.initialize = function (dir, done) {
  'use strict';

  var me = this,
      queue = [];

  if (dir && dir !== '') {
    queue.push(function (next) {
      me.addFromDir(dir, next);
    });
  }

  queue.push(function (next) {
    me._addFromDatabase(next);
  });

  async.series(queue, function (err) {
    done(err ? err : null);
  });
};

/**
 * Translates a given msg in the given language and stores in the database.
 *
 * @param {String} language The language the translation belongs to.
 * @param {String} str The english message that this is translating.
 * @param {String} translation The translated message to save.
 * @param {Function} done The done callback.
 * @param {Error} done.err Any raised errors.
 */
Locale.prototype.translate = function (language, str, translation, done) {
  'use strict';

  var me = this;

  this.core.database.collection('locales').findOne({
    language: language,
    msg: str
  }, function (err, doc) {
    if (err) {
      return done(err);
    }

    if (!doc) {
      doc = {
        language: language,
        msg: str
      };
    }

    doc.translation = translation;

    if (me._locales[language] === undefined) {
      me._locales[language] = {};
    }
    me._locales[language][str] = translation;

    me.core.database.collection('locales').save(doc, function (err2) {
      done(err2 ? err2 : null);
    });
  });
};

/**
 * Translate the given string.
 *
 * @param {String} language The language to translate to.
 * @param {String} str The string to translate to.
 * @param {Object} [params] The params for token replacement.
 * @return {String} The translated and token replaced string.
 */
Locale.prototype.t = function (language, str, params) {
  'use strict';

  if (this._locales[language] && this._locales[language][str]) {
    str = this._locales[language][str];
  }

  return this._strtr(str, params);
};

/**
 * Exports the Locales class.
 */
module.exports = Locale;
