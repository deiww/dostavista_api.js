/**
 * Модуль для AJAX-работы с API Dostavista.ru.
 * Использует в качесте транспорта jQuery.ajax(), результат отдаётся в JSONP.
 * Зависит от jQuery 1.8 и старше.
 * 
 * @param  {Object} global window
 * @param  {Object} document document
 * @param  {Function} $ jQuery
 * 
 * @author Oleg Gromov <mail@oleggromov.com>
 */
(function Dostavista(global, document, $) {
	/**
	 * Отключает ВСЕ сообщения плагина.
	 * @type {Boolean}
	 */
	var noDebug = false;

	var jsonpTimeout = 2 * 1000;

	// var apiUrl = 'http://dostavista.ru/bapi/order';
	var apiUrl = 'http://beta.dostavista.ru/bapi/order';

	var callbacks = {
		onParamsIllegal: null,
		onSendSuccess: null,
		onSendError: null
	};

	var authParams = {};

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

	/**
	 * Сохраняет параметры для доступа к API.
	 * 
	 * @param  	{Object} params	Параметры clientId, token.
	 * @return 	{Boolean} true, если всё в порядке.
	 */
	var setClient = function(params) {
		authParams.client_id = params.client_id || false;
		authParams.token = params.token || false;
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
	 * 
	 * @param  {Object} e Объект-событие.
	 */
	var handleClick = function(e) {
		var button = this;

		if (!_canSend.call(button)) return;

		_setButtonState.call(button, 'sending');

		if (!authParams.client_id || !authParams.token) {
			_error('Установите clientId и token сразу после подключения плагина.');
			return;
		}

		var params = _parseParams.call(button);
		try {
			_checkParams(params);
		} catch (e) {
			if (typeof callbacks['onParamsIllegal'] === 'function') {
				callbacks['onParamsIllegal'](params, e);
			} else {
				_error(e);
				_setButtonState.call(button, 'error', e);

				return;
			}
		}

		var apiCall = _sendOrder(params);
		apiCall.done(function ajaxDone(resJSON) {
			if (typeof callbacks['onSendSuccess'] === 'function') {
				callbacks['onSendSuccess'](resJSON);
			}

			_setButtonState.call(button, 'sent', 'ID заказа в Достависте: ' + resJSON.order_id);
		});

		apiCall.fail(function ajaxFail(jqxhr, text, error) {
			if (typeof callbacks['onSendError'] === 'function') {
				callbacks['onSendError'](text, error);
			} else {
				_error(text);
			}

			_setButtonState.call(button, 'error', text);
		});
	};


	/**
	 * Делает AJAX-запрос к API Достависты, получая результат в JSONP.
	 * Использует свой Deferred для обработки ошибок, чтобы делать promise.reject() при таймауте.
	 * 
	 * @param  {Object} params Хэш с обработанными параметрами
	 * @return {Promise} Разрешается, когда приходит ответ от сервера.
	 */
	var _sendOrder = function(params) {
		params = $.extend(params, authParams);
		
		var def = $.Deferred();
		$.ajax({
			data: params,
			// url: apiUrl,
			url: 'http://localhost',
			type: 'post',
			dataType: 'jsonp',
			cache: false
		}).done(function(result) {
			def.resolve(result);
		}).fail(function(jqxhr, text, error) {
			def.reject(jqxhr, text, error);
		});

		setTimeout(function() {
			def.reject(null, 'Ответа нет слишком долго. Возможно, проблемы с сетью.', null);
		}, jsonpTimeout);

		return def.promise();
	};


	/**
	 * Достаёт из DOM-ноды все аргументы, валидирует, преобразовывает в нужные типы 
	 * и раскладывает в правильную структуру.
	 * @TODO сделать нормальный парсинг телефона, даты
	 * 
	 * @return {Object} Хэш, в котором существующим в разметке ключам соответствуют их значения.
	 */
	var _parseParams = function() {
		var toNumber = function(val) { return Number(val); }
		var toDate = function(val) { return Date(val); }
		var toPhone = function(val) { return val; }

		var getParamsFromDomAttrs = function(attrs, domNode) {
			var params = {};
			var paramValue = null;
			for (var i = 0, max = attrs.length; i < max; i++) {
				paramValue = $(domNode).attr(attrs[i].name);
				if (paramValue) {
					params[attrs[i].name.replace('dsta-', '')] = attrs[i].parse ? attrs[i].parse(paramValue) : paramValue;
				}
			}

			return params;
		};

		var attrs = [
			{ name: "dsta-matter" },
			{ name: "dsta-insurance", parse: toNumber }
		];

		var pointAttrs = [
			{ name: "dsta-client_order_id" },
			{ name: "dsta-taking", parse: toNumber },
			{ name: "dsta-weight", parse: toNumber },
			{ name: "dsta-phone", parse: toPhone },
			{ name: "dsta-contact_person" },
			{ name: "dsta-required_time", parse: toDate },
			{ name: "dsta-required_time_start", parse: toDate },
			{ name: "dsta-address" }
		];

		// Api получает массив точек, но мы передаём только одну
		var params = {
			point: [
				{}
			]
		};

		params = $.extend(params, getParamsFromDomAttrs(attrs, this));
		params.point[0] = getParamsFromDomAttrs(pointAttrs, this);

		return params;
	};


	/**
	 * Проверяет корректность параметров и бросает исключение, если что-то не так.
	 * @TODO сделать нормальную проверку телефона, даты.
	 * 
	 * @param  {Object} params Хэш с параметрами, полученный от _parseParams.
	 * @return {[type]}        [description]
	 */
	var _checkParams = function(params) {
		var error = "";

		if (!params.matter) error += 'Не задан параметр matter.\n';
		if (!params.point[0]['address']) error += 'Не задан параметр point[0].address.\n';
		if (!params.point[0]['phone']) error += 'Не задан параметр point[0].phone.\n';
		if (!params.point[0]['required_time_start']) error += 'Не задан параметр point[0].time_start.\n';
		if (!params.point[0]['required_time']) error += 'Не задан параметр point[0].time.\n';
		if (!params.point[0]['weight']) error += 'Не задан параметр point[0].weight.\n';

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
		$(this).removeClass();
		$(this).addClass('DostavistaButton');
		$(this).addClass('DostavistaButton_' + state);

		if ($.inArray(state, ['sending', 'sent'])) {
			$(this).addClass('DostavistaButton_disabled');
		}

		$(this).removeAttr('title');
		if (title) $(this).attr('title', title);
	};

	/**
	 * Определяет, можно ли нажимать на кнопку.
	 * 
	 * @return {Boolean}
	 */
	var _canSend = function() {
		return !$(this).hasClass('DostavistaButton_disabled');
	};


	// Обработчики событий
	$(document).on('click', '.DostavistaButton', handleClick);

	// Глобально доступный интерфейс.
	global.DostavistaApi = {
		setClient: setClient,
		setCallback: setCallback
	};
})(window, document, jQuery);