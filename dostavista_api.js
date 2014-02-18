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
 * @version 0.9.0
 * 
 * @author Oleg Gromov <mail@oleggromov.com>
 * https://github.com/dostavista/dostavista_api.js
 */
(function DostavistaAPIClient(exports, document, $, testOnBeta) {
	/**
	 * Отключает ВСЕ сообщения плагина.
	 * @type {Boolean}
	 */
	var noDebug = false;

	/**
	 * Таймаут ответа от сервера, в секундах * 1000 мс.
	 * @type {Number}
	 */
	var jsonpTimeout = 5 * 1000;

	var apiUrl = testOnBeta ? 'http://beta.dostavista.ru/bapi/order' : 'http://dostavista.ru/bapi/order';
	// var apiUrl = 'http://localhost';

	var callbacks = {
		onBeforeSend: null,
		onSendSuccess: null,
		onSendError: null
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
		'4096': 'Неверный токен доступа'
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
			url: apiUrl,
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

		var xhr = $.ajax(sendParams)
			.done(onSendOrderDone)
			.fail(onSendOrderFail);

		setTimeout(function waitForJSONPTimeout() {
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

		var point0Attrs = [
			{ name: "dsta-point0_client_order_id" },
			{ name: "dsta-point0_taking", parse: toNumber },
			{ name: "dsta-point0_weight", parse: toNumber },
			{ name: "dsta-point0_phone", parse: toPhone },
			{ name: "dsta-point0_contact_person" },
			{ name: "dsta-point0_required_time" },
			{ name: "dsta-point0_required_time_start" },
			{ name: "dsta-point0_address" }
		];

		var point1Attrs = [
			{ name: "dsta-point1_taking", parse: toNumber },
			{ name: "dsta-point1_weight", parse: toNumber },
			{ name: "dsta-point1_phone", parse: toPhone },
			{ name: "dsta-point1_contact_person" },
			{ name: "dsta-point1_required_time" },
			{ name: "dsta-point1_required_time_start" },
			{ name: "dsta-point1_address" }
		];

		// Api получает массив точек, где point[0] — точка забора.
		var params = {
			point: [
				{}
			]
		};

		params = $.extend(params, getParamsFromDomAttrs(attrs, this));
		params.point[0] = getParamsFromDomAttrs(point0Attrs, this);
		params.point[1] = getParamsFromDomAttrs(point1Attrs, this);

		return params;
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

	// Глобально доступный интерфейс.
	exports.DostavistaApi = {
		setClient: setClient,
		setCallback: setCallback
	};
})(window, document, jQuery, true);