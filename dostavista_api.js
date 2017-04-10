/**
 * Модуль для AJAX-работы с API Dostavista.ru.
 * Использует в качесте транспорта jQuery.ajax(), результат отдаётся в JSONP.
 * Зависит от jQuery 1.8 и старше.
 *
 * @param  {Object} exports window
 * @param  {Object} document document
 * @param  {Function} $ jQuery
 * @param  {Boolean} Использовать ли хост beta.dostavista.ru
 *
 * @version 0.10.0
 *
 * @author Oleg Gromov <mail@oleggromov.com>
 * https://github.com/dostavista/dostavista_api.js
 */
(function DostavistaAPIClient(exports, document, $) {
    /**
     * Отключает ВСЕ сообщения плагина.
     * @type {Boolean}
     */
    var noDebug = true;

    /**
     * Таймаут ответа от сервера, в секундах * 1000 мс.
     * @type {Number}
     */
    var jsonpTimeout = 5 * 1000;
    var jsonpTimer;

    var API_URL = 'https://robotapitest.dostavista.ru/bapi/order';

    var apiUrl = API_URL;

    var callbacks = {
        onBeforeSend: null,
        onSendSuccess: null,
        onSendError: null,
        onError: null
    };
    var authParams = {};

    var apiErrors = {
        '20': 'Уже откликнулся на заказ',
        '22': 'Аукцион завершен, поздно делать ставки',
        '23': 'Невозможно отозвать ставку: ее нет',
        '24': 'Слишком большая ставка',
        '64': 'Неизвестная ошибка',
        '128': 'Попытка вызова API несуществующей версии',
        '1024': 'Неверный метод запроса (GET/POST)',
        '2048': 'Неверный идентификатор клиента',
        '4096': 'Неверный токен доступа',
        '8192': 'На точке указан телефон зарегистрированного клиента. Для продолжения требуется авторизоваться',
        '8193': 'Тип доставки не соответствует суммарному весу заказа',
        '8194': 'Сумма выкупа по активным заказам слишком велика'
    };

    /**
     * Выводит сообщение об ошибке в dev-консоль, если она доступна, либо делает alert.
     * При noDebug == true ничего не делает вообще.
     *
     * @param  {String} message Строка с сообщение об ошибке.
     */
    var _error = function(message) {
        var fallback = function(message) { alert('dostavista_api.js: ' + message); };

        if (noDebug) return;

        if (console) {
            try {
                console.error(message);
            } catch(e) { fallback(message); }
        } else {
            fallback(message);
        }
    };

    if (typeof $ !== 'function') {
        _error('Для работы необходим jQuery версии 1.8 и старше.');
        return;
    }


    var setApiUrl = function(url) {
        apiUrl = url;
    };

    /**
     * Сохраняет параметры для доступа к API.
     *
     * @param      {Object} params    Параметры clientId, token.
     * @return     {Boolean} true, если всё в порядке.
     */
    var setClient = function(params) {
        authParams.client_id = params.client_id || false;
        authParams.token = params.token || false;
    };

    /**
     * Переключает вывод отладочных сообщений в зависимости от параметра.
     *
     * @param {Boolean} state True включает отладку.
     */
    var setDebug = function(state) {
        noDebug = !state;
    };


    /**
     * Добавляет колбэк типа type, который берётся из ключей хэша callbacks.
     *
     * @param  {Strong}   type Строка-тип колбека
     * @param  {Function} fn   Колбэк
     * @return {Boolean}       True, если колбэк сохранён
     */
    var setCallback = function(type, fn) {
        if (!type || !fn) {
            _error('Недостаточно параметров.');
            return false;
        }

        if (!callbacks.hasOwnProperty(type)) {
            _error('Недопустимый тип колбэка.');
            return false;
        }

        if (typeof fn !== 'function') {
            _error('Второй аргумент должен быть функцией.');
            return false;
        }

        callbacks[type] = fn;
        return true;
    };


    /**
     * Обрабатывает клик по кнопке, проверяет параметры и отправляет их на сервер.
     * Вызывает установленные колбэки в нужное время.
     * Сбрасывает состояние при клике по кнопке с ошибкой.
     *
     * @param  {Object} e Объект-событие.
     */
    var handleClick = function(e) {
        e.preventDefault();
        var button = this;

        // Вызывается после того, как отработает onBeforeSend.
        var continueClickHandling = function() {
            // Парсим и проверям параметры.
            var params = _parseParams.call(button);

            try {
                _checkParams(params);
            } catch (e) {
                _error(e);
                _setButtonState.call(button, 'error', e);

                return;
            }

            // При ошибке вызывает колбэк и задаёт правильное состояние кнопки.
            var processError = function(jqxhr, text, error, message) {
                if (typeof callbacks['onSendError'] === 'function') {
                    callbacks['onSendError'](jqxhr, text, error);
                } else {
                    _error(message);
                }

                _setButtonState.call(button, 'error', message);
            };

            // Если всё хорошо, отсылаем запрос и ждём завершения.
            // Обрабатываем успешное окончание или ошибку.
            var apiCall = _sendOrder(params);
            apiCall.done(function onAjaxDone(resJSON) {
                if (resJSON.error_code) {
                    var errMsg = [];

                    for (var i = 0, max = resJSON.error_code.length; i < max; i++) {
                        errMsg.push(resJSON.error_code[i] + ': ' + apiErrors[resJSON.error_code[i]]);
                    }

                    processError(null, null, null, errMsg.join('\n'));
                    return;
                }

                if (typeof callbacks['onSendSuccess'] === 'function') {
                    callbacks['onSendSuccess'](resJSON, button);
                }

                // TODO вынести в какое-нибудь другое место
                _setButtonState.call(button, 'sent', 'ID заказа в Достависте: ' + resJSON.order_id);
            });

            apiCall.fail(function onAjaxFail(jqxhr, text, error) {
                processError(jqxhr, text, error, 'Ошибка отправки на ' + apiUrl);
            });
        };

        // Проверяем, была ли нажата кнопка. Если есть ошибка, сбрасываем, в противном случае ждём.
        if (!_canSend.call(button)) {
            if (_isErrorState.call(button)) {
                _setButtonState.call(button);
            }
            return;
        }

        if (!authParams.client_id || !authParams.token) {
            _error('Установите clientId и token сразу после подключения плагина.');
            return;
        }

        _setButtonState.call(button, 'sending');

        // Если установлен корректный onBeforeSend, то надо дождаться его окончания.
        if (typeof callbacks['onBeforeSend'] === 'function') {
            var promise = callbacks['onBeforeSend'].call(button);

            if (typeof promise !== 'object' || typeof promise.done !== 'function' || typeof promise.fail !== 'function') {
                _error('onBeforeSend-колбэк должен возвращать $.Deferred().promise().');
            } else {
                promise.always(function waitForOnBeforeSend() {
                    continueClickHandling();
                });
                return;
            }
        }

        continueClickHandling();
    };


    /**
     * Обрабатывает клик по кнопке, проверяет параметры и отправляет их на сервер.
     * Вызывает установленные колбэки в нужное время.
     * Сбрасывает состояние при клике по кнопке с ошибкой.
     *
     * @param  {Object} e Объект-событие.
     */
    var handleClickMulti = function(e) {
        e.preventDefault();
        var button = this;
        var parentDomNode = $(button).closest('.DostavistaCombo');
        var nodes = $('.DostavistaComboCheckbox:checked', parentDomNode);

        // Вызывается после того, как отработает onBeforeSend.
        var continueClickHandling = function() {
            // Парсим и проверям параметры.
            var params = _parseComboParams(nodes);

            try {
                _checkParams(params);
            } catch (e) {
                _error(e);
                _setComboButtonState.call(button, 'error', e);
                if (typeof callbacks['onError'] === 'function') {
                    callbacks['onError'](e, nodes);
                }

                return;
            }

            // При ошибке вызывает колбэк и задаёт правильное состояние кнопки.
            var processError = function(jqxhr, text, error, message) {
                if (typeof callbacks['onSendError'] === 'function') {
                    callbacks['onSendError'](jqxhr, text, error);
                } else {
                    _error(message);
                }

                _setComboButtonState.call(button, 'error', message);
            };

            // Если всё хорошо, отсылаем запрос и ждём завершения.
            // Обрабатываем успешное окончание или ошибку.
            var apiCall = _sendOrder(params);
            apiCall.done(function onAjaxDone(resJSON) {
                if (resJSON.error_code) {
                    var errMsg = [];

                    for (var i = 0, max = resJSON.error_code.length; i < max; i++) {
                        errMsg.push(resJSON.error_code[i] + ': ' + apiErrors[resJSON.error_code[i]]);
                    }

                    processError(null, null, null, errMsg.join('\n'));
                    return;
                }

                if (typeof callbacks['onSendSuccess'] === 'function') {
                    callbacks['onSendSuccess'](resJSON, nodes);
                }

                // TODO вынести в какое-нибудь другое место
                _setComboButtonState.call(button, 'sent', 'ID заказа в Достависте: ' + resJSON.order_id);
                nodes.attr('disabled','disabled').removeProp('checked');
            });

            apiCall.fail(function onAjaxFail(jqxhr, text, error) {
                processError(jqxhr, text, error, 'Ошибка отправки на ' + apiUrl);
            });
        };

        // Проверяем, была ли нажата кнопка. Если есть ошибка, сбрасываем, в противном случае ждём.
        if (!_canSend.call(button)) {
            if (_isErrorState.call(button)) {
                _setComboButtonState.call(button);
            }
            return;
        }

        if (!authParams.client_id || !authParams.token) {
            _error('Установите clientId и token сразу после подключения плагина.');
            return;
        }

        _setComboButtonState.call(button, 'sending');

        // Если установлен корректный onBeforeSend, то надо дождаться его окончания.
        if (typeof callbacks['onBeforeSend'] === 'function') {
            var promise = callbacks['onBeforeSend'].call(button);

            if (typeof promise !== 'object' || typeof promise.done !== 'function' || typeof promise.fail !== 'function') {
                _error('onBeforeSend-колбэк должен возвращать $.Deferred().promise().');
            } else {
                promise.always(function waitForOnBeforeSend() {
                    continueClickHandling();
                });
                return;
            }
        }

        continueClickHandling();
    };


    /**
     * Делает AJAX-запрос к API Достависты, получая результат в JSONP.
     * Использует свой Deferred для обработки ошибок, чтобы делать promise.reject() при таймауте.
     *
     * @param  {Object} params Хэш с обработанными параметрами
     * @return {Promise} Разрешается, когда приходит ответ от сервера.
     */
    var _sendOrder = function(params) {
        var def = $.Deferred();
        params = $.extend(params, authParams);

        var sendParams = {
            data: params,
            url: API_URL,
            type: 'post',
            dataType: 'jsonp',
            cache: false
        };

        var onSendOrderDone = function(result) {
            def.resolve(result);
        };

        var onSendOrderFail = function(jqxhr, text, error) {
            def.reject(jqxhr, text, error);
        };

        var removeTimer = function() {
            clearTimeout(jsonpTimer);
        };

        var xhr = $.ajax(sendParams)
            .done(onSendOrderDone)
            .fail(onSendOrderFail)
            .always(removeTimer);

        jsonpTimer = setTimeout(function waitForJSONPTimeout() {
            xhr.abort();
            def.reject(null, 'Ответа нет слишком долго. Возможно, проблемы с сетью.', null);
        }, jsonpTimeout);

        return def.promise();
    };


    /**
     * Достаёт из DOM-ноды все аргументы, валидирует, преобразовывает в нужные типы и раскладывает в правильную структуру.
     *
     * @return {Object} Хэш, в котором существующим в разметке ключам соответствуют их значения.
     */
    var _parseParams = function() {
        var toNumber = function(val) { return Number(val); }
        // Оставляет 10 последних цифр в телефоне, вырезая всё лишнее.
        var toPhone = function(val) {
            val = val.replace(/[^\d]/g, '');
            val = val.substr(val.length-10, val.length);
            return val;
        }

        var getParamsFromDomAttrs = function(attrs, domNode) {
            var params = {};
            var paramValue = null;
            for (var i = 0, max = attrs.length; i < max; i++) {
                paramValue = $(domNode).attr(attrs[i].name);
                if (!paramValue && ('required' in attrs[i])) {
                    return null;
                }
                if (paramValue) {
                    params[attrs[i].name.replace(/dsta-(\w*\d{1}_)?/, '')] = attrs[i].parse ? attrs[i].parse(paramValue) : paramValue;
                }
            }

            return params;
        };

        var attrs = [
            { name: "dsta-matter" },
            { name: "dsta-insurance", parse: toNumber }
        ];

        // Api получает массив точек, где point[0] — точка забора.
        var params = {
            point: [
                {}
            ]
        };

        params = $.extend(params, getParamsFromDomAttrs(attrs, this));

        for (var i=0; i<10; i++) {
            var prefix = 'dsta-point'+i+'_';
            var point = getParamsFromDomAttrs([
                { name: prefix+"address", required: true },
                { name: prefix+"client_order_id" },
                { name: prefix+"taking", parse: toNumber },
                { name: prefix+"weight", parse: toNumber },
                { name: prefix+"phone", parse: toPhone },
                { name: prefix+"contact_person" },
                { name: prefix+"required_time" },
                { name: prefix+"required_time_start" }
            ], this);
            if (point) {
                params.point[i] = point;
            }
            else {
                break;
            }
        }

        return params;
    };

    var _parseComboParams = function(domNodes) {
        var multiParams = {
            matter:null,
            insurance:0,
            point: []
        };
        domNodes.each(function(i,el){
            var params = _parseParams.call(el);
            if (!multiParams.matter) {
                multiParams.matter = params.matter;
            }
            if (params.insurance) {
                multiParams.insurance += params.insurance;
            }
            if ('point' in params && params.point.length) {
                if (multiParams.point.length && (params.point[0].address == multiParams.point[0].address)) {
                    // если первая точка уже есть в комбинированном заказе - не добавляем ее
                    if ('weight' in params.point[0]) {
                        multiParams.point[0].weight += params.point[0].weight;
                    }
                    params.point.shift();
                }
                $.merge(multiParams.point, params.point);
            }
        });
        return multiParams;
    };


    /**
     * Проверяет корректность параметров и бросает исключение, если что-то не так.
     *
     * @param  {Object} params Хэш с параметрами, полученный от _parseParams.
     * @return {[type]}        [description]
     */
    var _checkParams = function(params) {
        var datetime = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        var error = "";

        if (!params.matter){
            error += 'Не задан параметр matter.\n';
        }

        for (var i = 0, max = params.point.length; i < max; i++) {
            if (!params.point[i]['address']) {
                error += 'Не задан параметр point[' + i + '].address.\n';
            }

            if (!params.point[i]['phone'] || params.point[i]['phone'].length !== 10) {
                error += 'Параметр point[' + i + '].phone должен состоять из 10 цифр.\n';
            }

            if (!datetime.test(params.point[i]['required_time_start'])) {
                error += 'Параметр point[' + i + '].required_time_start должен быть в формате YYYY-MM-DD HH:MM:SS.\n';
            }

            if (!datetime.test(params.point[i]['required_time'])) {
                error += 'Параметр point[' + i + '].required_time должен быть в формате YYYY-MM-DD HH:MM:SS.\n';
            }

            if (!params.point[i]['weight']) {
                error += 'Не задан параметр point[' + i + '].weight.\n';
            }
        }

        if (error) {
            throw error;
        }
    }


    /**
     * Устанавливает состояние кнопки — CSS-класс, disabled и title.
     *
     * @param {String} state Одно из ['sending', 'sent', 'error']
     */
    var _setButtonState = function(state, title) {
        state = state || false;

        $(this).removeClass();
        $(this).addClass('DostavistaButton');

        if (state) {
            $(this).addClass('DostavistaButton_' + state);
            if ($.inArray(state, ['sending', 'sent', 'error']) > -1) {
                $(this).addClass('DostavistaButton_disabled');
            }
        }

        $(this).removeAttr('title');
        if (title) $(this).attr('title', title);
    };


    /**
     * Устанавливает состояние кнопки — CSS-класс, disabled и title.
     *
     * @param {String} state Одно из ['sending', 'sent', 'error']
     */
    var _setComboButtonState = function(state, title) {
        state = state || false;

        $(this).removeClass();
        $(this).addClass('DostavistaComboSubmit');

        if (state) {
            $(this).addClass('DostavistaComboSubmit_' + state);
            if ($.inArray(state, ['sending', 'sent', 'error']) > -1) {
                $(this).addClass('DostavistaButton_disabled');
            }
        }

        $(this).removeAttr('title');
        if (title) $(this).attr('title', title);
    };

    /**
     * Определяет, можно ли нажимать на кнопку по наличию disabled-модификатора.
     *
     * @return {Boolean}
     */
    var _canSend = function() {
        return !($(this).hasClass('DostavistaButton_disabled') || $(this).hasClass('DostavistaButton_sent'));
    };


    /**
     * Сообщает, находится ли кнопка в состоянии ошибки.
     *
     * @return {Boolean} Ошибка или нет
     */
    var _isErrorState = function() {
        return $(this).hasClass('DostavistaButton_error');
    };


    // Обработчики событий
    $(document).on('click', '.DostavistaButton', handleClick);

    // Обработчики событий
    $(document).on('click', '.DostavistaCombo .DostavistaComboSubmit', handleClickMulti);
    $(document).on('click', '.DostavistaCombo .DostavistaComboCheckbox', function() {
        var btn = $(this).closest('.DostavistaCombo').find('.DostavistaComboSubmit');
        _setComboButtonState.call(btn);
    });

    // Глобально доступный интерфейс.
    exports.DostavistaApi = {
        setApiUrl: setApiUrl,
        setClient: setClient,
        setCallback: setCallback,
        setDebug: setDebug
    };
})(window, document, jQuery);
