'use strict';

// manage.js

var
    _ = require('lodash'),
    fs = require('fs'),
    db = require('../db'),
    api = require('../api'),
    cache = require('../cache'),
    helper = require('../helper'),
    constants = require('../constants'),
    json_schema = require('../json_schema');

var
    User = db.user,
    Article = db.article,
    Category = db.category,
    warp = db.warp;

var
    userApi = require('./userApi'),
    wikiApi = require('./wikiApi'),
    discussApi = require('./discussApi'),
    articleApi = require('./articleApi'),
    webpageApi = require('./webpageApi'),
    settingApi = require('./settingApi'),
    categoryApi = require('./categoryApi'),
    attachmentApi = require('./attachmentApi'),
    navigationApi = require('./navigationApi');

var apisList = [categoryApi, articleApi, webpageApi, wikiApi, discussApi, attachmentApi, navigationApi, userApi, settingApi];

function getAllNavigationMenus(callback) {
    var fns = _.map(apisList, function (theApi) {
        // return [menu1, menu2, ... ]
        if (typeof (theApi.getNavigationMenus) === 'function') {
            return theApi.getNavigationMenus;
        }
        return function (callback) {
            callback(null, []);
        };
    });
    async.series(fns, function (err, results) {
        var menus = _.flatten(results);
        _.each(menus, function (m, index) {
            m.index = index.toString();
        });
        return callback(null, menus);
    });
}

function safeEncodeJSON(obj) {
    return '\'' + encodeURIComponent(JSON.stringify(obj)).replace(/\'/g, '\\\'') + '\'';
}

// do management console

var KEY_WEBSITE = constants.cache.WEBSITE;

function getId(request) {
    var id = request.query.id;
    if (id && id.length === 50) {
        return id;
    }
    throw api.notFound('id');
}

function* $getModel(model) {
    if (model === undefined) {
        model = {};
    }
    model.__website__ = yield settingApi.$getSettingsByDefaults(KEY_WEBSITE, settingApi.defaultSettings.website);
    return model;
}

module.exports = {

    'GET /manage/signin': function* () {
        /**
         * Display authentication.
         */
        this.render('manage/signin.html', yield $getModel());
    },

    'GET /manage/': function* () {
        this.response.redirect('/manage/article/');
    },

    // overview ///////////////////////////////////////////////////////////////

    'GET /manage/overview/(index)?': function* () {
        var page = helper.getPage(this.request);
        this.body = '';
    },

    // article ////////////////////////////////////////////////////////////////

    'GET /manage/article/(article_list)?': function* () {
        this.render('manage/article/article_list.html', yield $getModel({
            pageIndex: helper.getPageNumber(this.request)
        }));
    },

    'GET /manage/article/category_list': function* () {
        this.render('manage/article/category_list.html', yield $getModel({
            pageIndex: helper.getPageNumber(this.request)
        }));
    },

    'GET /manage/article/create_article': function* () {
        this.render('manage/article/article_form.html', yield $getModel({
            form: {
                name: 'Create Article',
                action: '/api/articles',
                redirect: 'article_list'
            }
        }));
    },

    'GET /manage/article/edit_article': function* () {
        var id = getId(this.request);
        this.render('manage/article/article_form.html', yield $getModel({
            id: id,
            form: {
                name: 'Edit Article',
                action: '/api/articles/' + id,
                redirect: 'article_list'
            }
        }));
    },

    'GET /manage/article/create_category': function* () {
        this.render('manage/article/category_form.html', yield $getModel({
            form: {
                name: 'Create Category',
                action: '/api/categories',
                redirect: 'category_list'
            }
        }));
    },

    'GET /manage/article/edit_category': function* () {
        var id = getId(this.request);
        this.render('manage/article/category_form.html', yield $getModel({
            id: id,
            form: {
                name: 'Edit Category',
                action: '/api/categories/' + id,
                redirect: 'category_list'
            }
        }));
    },

    // webpage ////////////////////////////////////////////////////////////////

    'GET /manage/webpage/(webpage_list)?': function* () {
        this.render('manage/webpage/webpage_list.html', yield $getModel({}));
    },

    'GET /manage/webpage/create_webpage': function* () {
        this.render('manage/webpage/webpage_form.html', yield $getModel({
            form: {
                name: 'Create Web Page',
                action: '/api/webpages',
                redirect: 'webpage_list'
            },
        }));
    },

    'GET /manage/webpage/edit_webpage': function* () {
        var id = getId(this.request);
        this.render('manage/webpage/webpage_form.html', yield $getModel({
            id: id,
            form: {
                name: 'Edit Web Page',
                action: '/api/webpages/' + id,
                redirect: 'webpage_list'
            },
        }));
    },

    // wiki ///////////////////////////////////////////////////////////////////

    'GET /manage/wiki/(wiki_list)?': function* () {
        this.render('manage/wiki/wiki_list.html', yield $getModel({}));
    },

    'GET /manage/wiki/create_wiki': function* () {
        this.render('manage/wiki/wiki_form.html', yield $getModel({
            form: {
                name: 'Create Wiki',
                action: '/api/wikis',
                redirect: 'wiki_list'
            }
        }));
    },

    'GET /manage/wiki/edit_wiki': function* () {
        var id = getId(this.request);
        this.render('manage/wiki/wiki_form.html', yield $getModel({
            id: id,
            form: {
                name: 'Edit Wiki',
                action: '/api/wikis/' + id,
                redirect: 'wiki_tree?id=' + id
            }
        }));
    },

    'GET /manage/wiki/wiki_tree': function* () {
        var id = getId(this.request);
        this.render('manage/wiki/wiki_tree.html', yield $getModel({
            id: id
        }));
    },

    'GET /manage/wiki/edit_wikipage': function* () {
        var
            id = getId(this.request),
            wp = yield wikiApi.$getWikiPage(id);
        this.render('manage/wiki/wikipage_form.html', yield $getModel({
            id: id,
            form: {
                name: 'Edit Wiki Page',
                action: '/api/wikis/wikipages/' + id,
                redirect: 'wiki_tree?id=' + wp.wiki_id
            }
        }));
    },

    // board //////////////////////////////////////////////////////////////////

    'GET /manage/discuss/(index)?': function (req, res, next) {
        discussApi.getBoards(function (err, boards) {
            if (err) {
                return next(err);
            }
            return res.render('manage/discuss/board_list.html', {
                boards: JSON.stringify(_.flatten(boards))
            });
        });
    },

    'GET /manage/discuss/create_board': function (req, res, next) {
        return res.render('manage/discuss/board_form.html', {
            form: {
                name: 'Create Board',
                action: '/api/boards',
                redirect: '/manage/discuss/'
            },
            board: {}
        });
    },

    'GET /manage/discuss/edit_board': function (req, res, next) {
        discussApi.getBoard(req.query.id, function (err, obj) {
            if (err) {
                return next(err);
            }
            if (obj === null) {
                return next(api.notFound('Board'));
            }
            return res.render('manage/discuss/board_form.html', {
                form: {
                    name: 'Edit Board',
                    action: '/api/boards/' + obj.id + '/',
                    redirect: '/manage/discuss/'
                },
                board: obj
            });
        });
    },

    'GET /manage/discuss/reply_list': function (req, res, next) {
        var page = utils.getPage(req);
        discussApi.getAllReplies(page, function (err, results) {
            if (err) {
                return next(err);
            }
            userApi.bindUsers(results.replies, function (err, r) {
                if (err) {
                    return next(err);
                }
                return res.render('manage/discuss/reply_list.html', {
                    page: JSON.stringify(results.page),
                    replies: JSON.stringify(results.replies)
                });
            });
        });
    },

    'GET /manage/discuss/topic_list': function (req, res, next) {
        var
            board_id = req.query.board_id,
            page = utils.getPage(req);
        discussApi.getBoard(board_id, function (err, board) {
            if (err) {
                return next(err);
            }
            discussApi.getTopics(board_id, page, function (err, results) {
                if (err) {
                    return next(err);
                }
                userApi.bindUsers(results.topics, function (err, r) {
                    if (err) {
                        return next(err);
                    }
                    return res.render('manage/discuss/topic_list.html', {
                        board: JSON.stringify(board),
                        page: JSON.stringify(results.page),
                        topics: JSON.stringify(results.topics)
                    });
                });
            });
        });
    },

    // attachment /////////////////////////////////////////////////////////////

    'GET /manage/attachment/(index)?': function (req, res, next) {
        var page = utils.getPage(req);
        attachmentApi.getAttachments(page, function (err, results) {
            if (err) {
                return next(err);
            }
            return res.render('manage/attachment/attachment_list.html', {
                page: JSON.stringify(results.page),
                attachments: JSON.stringify(results.attachments)
            });
        });
    },

    // user ///////////////////////////////////////////////////////////////////

    'GET /manage/user/(index)?': function (req, res, next) {
        var page = utils.getPage(req);
        userApi.getUsers(page, function (err, results) {
            if (err) {
                return next(err);
            }
            return res.render('manage/user/user_list.html', {
                now: Date.now(),
                page: JSON.stringify(results.page),
                users: JSON.stringify(results.users)
            });
        });
    },

    // navigation /////////////////////////////////////////////////////////////

    'GET /manage/navigation/(index)?': function (req, res, next) {
        navigationApi.getNavigations(function (err, navigations) {
            if (err) {
                return next(err);
            }
            return res.render('manage/navigation/navigation_list.html', {
                navigations: JSON.stringify(navigations)
            });
        });
    },

    'GET /manage/navigation/create_navigation': function (req, res, next) {
        getAllNavigationMenus(function (err, menus) {
            if (err) {
                return next(err);
            }
            return res.render('manage/navigation/navigation_menu_form.html', {
                form: {
                    name: 'Create Navigation',
                    action: '/api/navigations/',
                    redirect: '/manage/navigation/'
                },
                menus: menus
            });
        });
    },

    'GET /manage/navigation/edit_navigation': function (req, res, next) {
        navigationApi.getNavigation(req.query.id, function (err, obj) {
            if (err) {
                return next(err);
            }
            return res.render('manage/navigation/navigation_form.html', {
                form: {
                    name: 'Edit Navigation',
                    action: '/api/navigations/' + obj.id + '/',
                    redirect: '/manage/navigation/'
                },
                navigation: obj
            });
        });
    },

    // setting ////////////////////////////////////////////////////////////////

    'GET /manage/setting/(index)?': function (req, res, next) {
        var makeField = function (name, value, label, type) {
            return {
                name: name,
                value: value,
                label: label || (name.charAt(0) + name.substring(1)),
                type: type || 'text'
            };
        };
        settingApi.getSettingsByDefaults('website', settingApi.defaultSettings.website, function (err, website) {
            if (err) {
                return next(err);
            }
            return res.render('manage/setting/setting_list.html', {
                form: {
                    name: 'Settings',
                    action: '/manage/setting/save'
                },
                model: safeEncodeJSON({
                    website: website,
                    datetime: {
                        timezone: 'GMT+08:00',
                        date_format: 'yyyy-MM-dd',
                        time_format: 'hh:mm:ss'
                    }
                }),
                settings: [
                    {
                        name: 'website',
                        label: 'Website',
                        fields: [
                            makeField('name', website.name, 'Name'),
                            makeField('description', website.description, 'Description'),
                            makeField('keywords', website.keywords, 'Keywords'),
                            makeField('xmlns', website.xmlns, 'XML Namespace'),
                            makeField('custom_header', website.custom_header, 'Custom Header', 'textarea'),
                            makeField('custom_footer', website.custom_footer, 'Custom Footer', 'textarea')
                        ]
                    },
                    {
                        name: 'datetime',
                        label: 'Date and Time',
                        fields: [
                            makeField('timezone', website.timezone, 'Timezone', 'select'),
                            makeField('date_format', website.date_format, 'Date Format', 'select'),
                            makeField('time_format', website.time_format, 'Time Format', 'select')
                        ]
                    }
                ]
            });
        });
    },

    'POST /manage/setting/save': function (req, res, next) {
        var
            settings = ['website', 'datetime'],
            tasks = [];
        _.each(settings, function (group) {
            tasks.push(function (callback) {
                settingApi.setSettings(group, req.body[group], callback);
            });
        });
        async.series(tasks, function (err, results) {
            if (err) {
                return next(err);
            }
            cache.remove(constants.CACHE_KEY_WEBSITE_SETTINGS);
            return res.send({ result: true });
        });
    }
};