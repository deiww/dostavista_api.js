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
(function DSTA(global, document, $) {
	/**
	 * Отключает ВСЕ сообщения плагина.
	 * @type {Boolean}
	 */
	var noDebug = false;

	// var apiUrl = 'http://dostavista.ru/bapi/order';
	var apiUrl = 'http://beta.dostavista.ru/bapi/order';

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
		authParams.client_id = params.clientId || false;
		authParams.token = params.token || false;
	};

	/**
	 * Обрабатывает клик по кнопке, проверяет параметры и отправляет их на сервер.
	 * 
	 * @param  {Object} e Объект-событие.
	 */
	var handleClick = function(e) {
		e.preventDefault();

		if (!authParams.client_id || !authParams.token) {
			_error('Установите clientId и token сразу после подключения плагина.');
			return;
		}

		var params = _parseParams.call(this);
		try {
			_checkParams(params);
		} catch (e) {
			_error(e);
			// TODO хук для отсутствующих параметров
			return;
		}

		var apiCall = _sendOrder(params);
		apiCall.done(function ajaxDone(result) {
			console.log(result);

			// TODO хук для обработки успешного результата
		});

		apiCall.fail(function ajaxFail(jqxhr, text, error) {
			console.log(text);
			console.log(error);

			// хук для обработки ошибки.
		});
	};


	/**
	 * Делает AJAX-запрос к API Достависты, получая результат в JSONP.
	 * 
	 * @param  {Object} params Хэш с обработанными параметрами
	 * @return {Promise} Разрешается, когда приходит ответ от сервера.
	 */
	var _sendOrder = function(params) {
		params = $.extend(params, authParams);

		return $.ajax({
			data: params,
			url: apiUrl,
			type: 'post',
			dataType: 'jsonp',
			cache: false
		});
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
		if (!params.point[0]['address']) error += 'Не задан параметр address.\n';
		if (!params.point[0]['phone']) error += 'Не задан параметр phone.\n';
		if (!params.point[0]['required_time_start']) error += 'Не задан параметр time_start.\n';
		if (!params.point[0]['required_time']) error += 'Не задан параметр time.\n';
		if (!params.point[0]['weight']) error += 'Не задан параметр weight.\n';

		if (error) {
			throw error;
		}
	}


	// Обработчики событий
	$(document).on('click', '.DSTA_button', handleClick);

	// Глобально доступный интерфейс.
	global.DostavistaApi = {
		setClient: setClient
	};
})(window, document, jQuery);