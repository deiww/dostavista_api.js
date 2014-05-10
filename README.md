# Javascript-клиент для API dostavista.ru

**Задача библиотеки:** облегчить интеграцию интернет-магазинов со службой доставки Dostavista.ru.

JS-клиент предназначен для подключения к админке интернет-магазина, работает поверх XMLHttpRequest и предоставляет простой способ отправлять заказы в службу доставки.

## Правила работы

1. **Скачать последнюю версию библиотеки из `build/` и подключить** к странице, с которой планируется отправлять заказы в Достависту.

	```html
	<head>
		...
		<link rel="stylesheet" href="dostavista_api.min.css">
	</head>

	...
	<script src="dostavista_api.min.js"></script>
	</body>
	```

2. **Вставить тег `<span class="DostavistaButton"></span>`** рядом с каждым заказом. Одна кнопка отправляет в Достависту один заказ.

3. **Добавить dsta-аттрибуты, описывающие каждый заказ.** Для каждого тега `.DostavistaButton` в разметке на момент инициализации Javascript должны содержаться все необходимые параметры, либо можно воспользоваться колбэком `onBeforeSend` (см. ниже).

	```html
	<span class="DostavistaButton"
		...
		dsta-matter="Видеорегистратор"
		dsta-insurance="15000"
		...

		></span>
	```

    или для комбо-заказов

	```html
    <div class="DostavistaCombo">
        <ol>
            <li>
                <label>
                    <input type="checkbox" class="DostavistaComboCheckbox"
                           dsta-matter="Проверочная доставка с несколькими точками"
                           dsta-insurance="13000"

                           dsta-point0_address="ул. Новокосинская улица, 13"
                           dsta-point0_required_time_start="2013-12-30 18:00:00"
                           dsta-point0_required_time="2013-12-30 20:00:00"
                           dsta-point0_contact_person="Контактное лицо магазина"
                           dsta-point0_phone="+7 (923) 000-00-00"
                           dsta-point0_weight="4"

                           dsta-point1_address="Покровка, 13"
                           dsta-point1_required_time_start="2014-02-15 18:00:00"
                           dsta-point1_required_time="2014-02-15 20:00:00"
                           dsta-point1_contact_person="Олег"
                           dsta-point1_phone="+7 (915) 123-03-00"
                           dsta-point1_weight="4"
                           dsta-point1_taking="4500"
                           dsta-point1_client_order_id="1"
                           />
                    1 заказ
                </label>
            </li>
            <li>
                <label>
                    <input type="checkbox" class="DostavistaComboCheckbox"
                           dsta-matter="Проверочная доставка с несколькими точками"
                           dsta-insurance="13000"

                           dsta-point0_address="ул. Новокосинская улица, 13"
                           dsta-point0_required_time_start="2013-12-30 18:00:00"
                           dsta-point0_required_time="2013-12-30 20:00:00"
                           dsta-point0_contact_person="Контактное лицо магазина"
                           dsta-point0_phone="+7 (923) 000-00-00"
                           dsta-point0_weight="4"

                           dsta-point1_address="Осенний, 1"
                           dsta-point1_required_time_start="2014-02-15 18:00:00"
                           dsta-point1_required_time="2014-02-15 20:00:00"
                           dsta-point1_contact_person="Олег"
                           dsta-point1_phone="+7 (915) 123-03-00"
                           dsta-point1_weight="4"
                           dsta-point1_taking="4500"
                           dsta-point1_client_order_id="2"
                           />
                    2 заказ
                </label>
            </li>
        </ol>
        <button class="DostavistaComboSubmit"></button>
    </div>
	```

	**Полный список всех атрибутов**

	| Атрибут | Тип и ограничения | Значение |
	|---------|-------------------|----------|
	| `dsta-matter` | Строка | Что везём, например «диктофон» или «видеорегистратор» |
	| `dsta-insurance` | Целое число от 0 до 15000 | Сумма страховки в рублях |
	| `dsta-point0_address` | Строка | Адрес первой точки маршрута |
	| `dsta-point0_required_time_start` | YYYY-MM-DD HH:MM:SS | Время прибытия на точку (от) * обязательно |
	| `dsta-point0_required_time` | YYYY-MM-DD HH:MM:SS | Время прибытия на точку (до) * обязательно |
	| `dsta-point0_contact_person` | Строка | Имя контактного лица на точке забора |
	| `dsta-point0_phone` | 10 цифр без знака + и международного кода | Телефон контактного лица на точке забора |
	| `dsta-point0_weight` | Целое число | Вес на точке |
	| `dsta-point0_taking` | Целое число | Стоимость на точке: сумма, которую должен взять курьер на точке |
	| `dsta-point0_client_order_id` | Строка | Номер заказа в магазине, используется для уведомлений на точках |


	> Копейки и десятые доли килограмма отбрасываются, даже если их указать.

    > Каждый заказ может иметь до 10 точек. Для задания номера точки используется цифра после dsta-point (от 0 до 9). Атрибуты, начинающиеся с dsta-point0_, описывают первую точку, dsta-point1_ - вторую, dsta-point2_ - третью и так далее.


4. **Задать общие для всех обращений к API Достависты параметры: `client_id` и `token`** для правильной авторизации в API. Метод `setClient` не делает AJAX-запросов, а просто сохраняет общие параметры на будущее.

	```html
	<script>
		DostavistaApi.setClient({
			client_id: 1234,
			token: 'xxxx'
		});
	</script>
	```

5. **Задать необходимые колбэки**. Доступные варианты перечислены в таблице ниже.

	```html
	<script>
		DostavistaApi.setCallback('onSendSuccess', function(result, button) {
			alert('Заказ ' + result.order_id + ' доставлен');
		});
	</script>
	```

	**Доступные колбэки**

	| Название | Параметры | Описание |
	|----------|-----------|----------|
	| onBeforeSend |  | Вызывается до отправки данных и парсинга параметров. Можно использовать, чтобы добавить отсутствующие параметры. Должен возвращать `jQuery.Deferred.promise()` — см. код примера `api_test.html`! |
	| onSendSuccess | result, button | Выполняется, если заказ отправлен в Достависту. Получает result (объект с ответом API) и button (DOM-ноду с кнопкой). |
	| onSendError | jqxhr, text, error | Выполняется, если при отправке произошла ошибка. Получает параметры, идентичные методу $.ajax().fail(). |
	| onError | error | Выполняется, если при формировании заказа произошла ошибка (невалидные данные). Функция принимает 1 параметр error - текст сообщения об ошибке. |


## TODO
2. Сделать атрибуты для задания своей точки забора для каждого заказа.
3. Перейти на CORS


### Технический TODO
1. Отказаться от jQuery
2. Тесты
3. Запихнуть весь код в [песочницу](https://github.com/a-ignatov-parc/requirejs-sandbox)

### Текущий TODO
1. Продумать как следует юзкейсы
2. Обновить README
3. Добавить в README пункт о тестировании на beta.dostavista.ru, согласовать процесс тестирования с Юрой

3. Класть стили текстом в `<style>` из скрипта
4. Как это сделать с grunt.js?

4. Сделать методы для установки первого адреса по-умолчанию.
5. Заменить дата-атрибуты на JSON на `dsta-from="{}"` и `dsta-to="{}"`.

12. **Прятать кнопки или ставить DostavistaButton_sent для заказов, которые уже синхронизированы**
13. Доработать API и клиент, чтобы можно было менять кнопки «В Достависту» на номер заказа со ссылкой.

14. Нормальная обработка JSONP-ошибок.
15. Переделать логику состояний кнопки

16. Оформить как bower-модуль

17. continueClickHandling вынести из handleClick
12. Добавить возможность устанавливать несколько колбеков на событие