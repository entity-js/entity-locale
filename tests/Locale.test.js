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

require('entity-core');

var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    test = require('unit.js'),
    loader = require('nsloader'),
    EntityCore = loader('Entity'),
    Locale = loader('Entity/Locale');

var core;

describe('entity/Locale', function () {

  'use strict';

  var tmpPath = path.join(
        __dirname, 'entity-tests--locale--' + process.pid
      );

  beforeEach(function (done) {

    core = new EntityCore();
    core.database.connect('test', {
      name: 'test',
      host: '0.0.0.0'
    }, true);

    fs.mkdirSync(tmpPath);

    var translations = {
      'test1.fr.json': {
        'Hello world': 'Foo bar'
      },
      'test2.fr.json': {
        'Hello world': 'Foo bar 2',
        'Hello :name, welcome back': 'Foo :name, bar'
      },
      'test1.jp.json': {
        'Hello :name, welcome back': 'Goodbye :name'
      }
    };

    for (var filename in translations) {
      fs.writeFileSync(
        path.join(tmpPath, filename),
        JSON.stringify(translations[filename])
      );
    }

    done();

  });

  afterEach(function (done) {

    var translations = ['test1.fr.json', 'test2.fr.json', 'test1.jp.json'];
    for (var i = 0, len = translations.length; i < len; i++) {
      fs.unlinkSync(path.join(tmpPath, translations[i]));
    }

    fs.rmdirSync(tmpPath);

    core.database.collection('locales', 'test').drop(function () {
      core.database.disconnect('test');
      done();
    });

  });

  describe('Locale.addFromFile()', function () {

    it('shouldProcessTheTranslationFile', function (done) {

      var locale = new Locale(core);

      test.array(
        locale.languages
      ).is([]);

      locale.addFromFile(path.join(tmpPath, 'test1.fr.json'), function (err) {

        test.value(
          err
        ).isNull();

        test.array(
          locale.languages
        ).is(['fr']);

        test.object(
          locale.locales('fr')
        ).is({
          'Hello world': 'Foo bar'
        });

        done();

      });

    });

    it('shouldMergeButNotReplace', function (done) {

      var queue = [],
          locale = new Locale(core);

      queue.push(function (next) {

        locale.addFromFile(path.join(tmpPath, 'test1.fr.json'), next);

      });

      queue.push(function (next) {

        locale.addFromFile(path.join(tmpPath, 'test2.fr.json'), next);

      });

      queue.push(function (next) {

        test.array(
          locale.languages
        ).is(['fr']);

        test.object(
          locale.locales('fr')
        ).is({
          'Hello world': 'Foo bar',
          'Hello :name, welcome back': 'Foo :name, bar'
        });

        next();
      });

      async.series(queue, done);

    });

  });

  describe('Locale.addFromDir()', function () {

    it('shouldProcessAllTranslationFiles', function (done) {

      var locale = new Locale(core);

      test.array(
        locale.languages
      ).is([]);

      locale.addFromDir(tmpPath, function (err) {

        test.value(
          err
        ).isNull();

        test.array(
          locale.languages
        ).is(['fr', 'jp']);

        test.object(
          locale.locales('fr')
        ).is({
          'Hello world': 'Foo bar',
          'Hello :name, welcome back': 'Foo :name, bar'
        });

        test.object(
          locale.locales('jp')
        ).is({
          'Hello :name, welcome back': 'Goodbye :name'
        });

        done();

      });

    });

  });

  describe('Locale.languages', function () {

    it('shouldReturnAnEmptyArrayIfNoLanguages', function () {

      var locale = new Locale(core);

      test.array(
        locale.languages
      ).is([]);

    });

    it('shouldReturnLanguageNames', function (done) {

      var locale = new Locale(core);

      locale.addFromDir(tmpPath, function (err) {

        test.value(
          err
        ).isNull();

        test.array(
          locale.languages
        ).is(['fr', 'jp']);

        done();

      });

    });

  });

  describe('Locale.locales()', function () {

    it('shouldThrowAnErrorIfLocaleIsUndefined', function () {

      var locale = new Locale(core);

      test.error(function () {
        locale.locales('fr');
      }).isInstanceOf(Error);

    });

  });

  describe('Locale.translate()', function () {

    it('shouldAddTranslationToTheDatabase', function (done) {

      var locale = new Locale(core),
          queue = [];

      queue.push(function (next) {

        locale.core.database
          .collection('locales')
          .find({}, function (err, docs) {

            if (err) {
              return next(err);
            }

            test.array(
              docs
            ).hasLength(0);

            next();

          });

      });

      queue.push(function (next) {

        locale.translate('fr', 'Hello world', 'Foo bar', next);

      });

      queue.push(function (next) {

        locale.core.database
          .collection('locales')
          .find({}, function (err, docs) {

          if (err) {
            return next(err);
          }

          test.array(
            docs
          ).hasLength(1);

          test.object(docs[0])
            .hasKey('language', 'fr')
            .hasKey('msg', 'Hello world')
            .hasKey('translation', 'Foo bar');

          next();

        });

      });

      queue.push(function (next) {

        test.object(
          locale.locales('fr')
        ).is({
          'Hello world': 'Foo bar'
        });

        next();

      });

      async.series(queue, done);

    });

    it('shouldOverrideFileTranslation', function (done) {

      var locale = new Locale(core),
          queue = [];

      queue.push(function (next) {

        locale.addFromFile(path.join(tmpPath, 'test1.fr.json'), next);

      });

      queue.push(function (next) {

        test.object(
          locale.locales('fr')
        ).is({
          'Hello world': 'Foo bar'
        });

        next();

      });

      queue.push(function (next) {

        locale.translate('fr', 'Hello world', 'Goodbye', next);

      });

      queue.push(function (next) {

        test.object(
          locale.locales('fr')
        ).is({
          'Hello world': 'Goodbye'
        });

        next();

      });

      async.series(queue, done);

    });

    it('translatingUpdatesDatabaseEntry', function (done) {

      var locale = new Locale(core),
          queue = [];

      queue.push(function (next) {

        locale.translate('fr', 'Hello world', 'Foo bar', next);

      });

      queue.push(function (next) {

        locale.core.database
          .collection('locales')
          .find({}, function (err, docs) {

          if (err) {
            return next(err);
          }

          test.array(
            docs
          ).hasLength(1);

          test.object(docs[0])
            .hasKey('language', 'fr')
            .hasKey('msg', 'Hello world')
            .hasKey('translation', 'Foo bar');

          next();

        });

      });

      queue.push(function (next) {

        test.object(
          locale.locales('fr')
        ).is({
          'Hello world': 'Foo bar'
        });

        next();

      });

      queue.push(function (next) {

        locale.translate('fr', 'Hello world', 'Goodbye', next);

      });

      queue.push(function (next) {

        locale.core.database
          .collection('locales')
          .find({}, function (err, docs) {

          if (err) {
            return next(err);
          }

          test.array(
            docs
          ).hasLength(1);

          test.object(docs[0])
            .hasKey('language', 'fr')
            .hasKey('msg', 'Hello world')
            .hasKey('translation', 'Goodbye');

          next();

        });

      });

      queue.push(function (next) {

        test.object(
          locale.locales('fr')
        ).is({
          'Hello world': 'Goodbye'
        });

        next();

      });

      async.series(queue, done);

    });

    it('cantOverrideDatabaseTranslation', function (done) {

      var locale = new Locale(core),
          queue = [];

      queue.push(function (next) {

        locale.translate('fr', 'Hello world', 'Goodbye', next);

      });

      queue.push(function (next) {

        locale.addFromFile(path.join(tmpPath, 'test1.fr.json'), next);

      });

      queue.push(function (next) {

        test.object(
          locale.locales('fr')
        ).is({
          'Hello world': 'Goodbye'
        });

        next();

      });

      async.series(queue, done);

    });

  });

  describe('Locale.initialize()', function () {

    it('shouldLoadTranslationsFromDirectoryAndDatabase', function (done) {

      var locale = new Locale(core),
          queue = [];

      queue.push(function (next) {

        locale.core.database
          .collection('locales')
          .save({
            language: 'fr',
            msg: 'Hello world',
            translation: 'Goodbye'
          }, next);

      });

      queue.push(function (next) {

        locale.initialize(tmpPath, next);

      });

      queue.push(function (next) {

        test.array(
          locale.languages
        ).is(['fr', 'jp']);

        test.object(
          locale.locales('fr')
        ).is({
          'Hello world': 'Goodbye',
          'Hello :name, welcome back': 'Foo :name, bar'
        });

        test.object(
          locale.locales('jp')
        ).is({
          'Hello :name, welcome back': 'Goodbye :name'
        });

        next();

      });

      async.series(queue, done);

    });

  });

  describe('Locale.strtr()', function () {

    it('shouldReturnMsgWithNoParams', function () {

      var locale = new Locale(core);

      test.string(
        locale._strtr('Hello world')
      ).is('Hello world');

    });

    it('shouldReturnMsgWithParams', function () {

      var locale = new Locale(core);

      test.string(
        locale._strtr('Hello :arg', {'arg': 'world'})
      ).is('Hello world');

    });

  });

  describe('Locale.t()', function () {

    it('shouldReturnMsgIfNoTranslations', function () {

      var locale = new Locale(core);

      test.string(
        locale.t('fr', 'Hello world')
      ).is('Hello world');

    });

    it('shouldReturnMsgIfNoTranslationsWithParams', function () {

      var locale = new Locale(core);

      test.string(
        locale.t('fr', 'Hello :arg', {'arg': 'world'})
      ).is('Hello world');

    });

    it('shouldReturnTranslatedMsg', function (done) {

      var locale = new Locale(core),
          queue = [];

      queue.push(function (next) {

        locale.addFromFile(path.join(tmpPath, 'test1.fr.json'), next);

      });

      queue.push(function (next) {

        test.string(
          locale.t('fr', 'Hello world')
        ).is('Foo bar');

        next();

      });

      async.series(queue, done);

    });

    it('shouldReturnTranslatedMsgWithParams', function (done) {

      var locale = new Locale(core),
          queue = [];

      queue.push(function (next) {

        locale.addFromFile(path.join(tmpPath, 'test1.fr.json'), next);

      });

      queue.push(function (next) {

        test.string(
          locale.t('fr', 'Hello :name, welcome back', {'name': 'John'})
        ).is('Hello John, welcome back');

        next();

      });

      async.series(queue, done);

    });

  });

});
