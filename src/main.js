import { buildQuery } from './query.js';
import {
  fetchAndRender, setSortOrder, loadMore, hasCachedData,
  setTranslateEnabled, setTranslateLanguage, toggleSelectMode, clearSelection, selectAll,
  getSelectedArticles, setSelectionChangeCallback,
  setOnRenderCallback, setOnTranslateCallback, setUiStrings,
  setCountryFilter, getCountryFilter,
  getDisplayArticles, getVisibleArticles, buildArticleRowsHtml, getMapArticles,
} from './headlines.js';
import { initHybridMap, updateHybridMap, setMapCountryClickHandler, setMapUiStrings } from './mapview.js';
import { COUNTRY_COORDS } from './countries.js';

let currentView = 'hybrid', currentTimespan = '7d';
let translateEnabled = true, lastBuiltQuery = '', selectModeOn = false;
const LS_KEY = 'nm_default';
let countryNames = [];
let activeCountrySuggestion = -1;
let _hybridStatusActive = false;
let _pendingTranslateResolve = null;

const el  = id  => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];

function normalizeTranslateLanguage(language) {
  const normalized = String(language || 'en').trim().toLowerCase();
  if (!normalized) return 'en';
  if (normalized === 'sp') return 'es';
  if (normalized === 'pt-br') return 'pt';
  if (normalized === 'zh-cn') return 'zh-CN';
  if (normalized === 'ch' || normalized === 'cn' || normalized === 'zh') return 'zh-CN';
  return normalized;
}

let currentUiLanguage = 'en';

const LANGUAGE_OPTION_LABELS = {
  en: 'EN 中',
  es: 'SP',
  pt: 'PT',
  ru: 'RU',
  'zh-CN': '中',
};

const UI_TEXT = {
  en: {
    pageTitle: 'NewsMapper 2.0 — Natural Resources',
    htmlLang: 'en',
    translateSelectorLabel: 'Translate UI and headlines',
    topbarSub: 'Natural Resources Intelligence',
    topbarPowered: 'powered by GDELT',
    headlinesRegion: 'Headlines',
    hybridRegion: 'Hybrid map + headlines',
    searchQuery: 'Search query',
    placeholderHtml: 'Select a resource and click <strong>Search</strong> to load headlines.',
    fetchingHeadlines: 'Fetching headlines…',
    cancel: 'Cancel',
    emptyState: 'No articles found. Try a different query or longer timespan.',
    tryAgain: 'Try again',
    loadMore: 'Load more',
    hideMap: 'Hide map',
    showMap: 'Show map',
    defaultBadge: '★ default',
    defaultBadgeAria: 'Loaded from saved default',
    setDefault: 'Set default',
    saveCurrentQuery: 'Save current query as default',
    sortHeadlinesBy: 'Sort headlines by',
    sortHybridHeadlinesBy: 'Sort hybrid headlines by',
    newestFirst: 'Newest first',
    oldestFirst: 'Oldest first',
    select: 'Select',
    selectArticles: 'Select articles to share or export',
    resource: 'Resource',
    selectResource: 'Select resource',
    region: 'Region',
    selectRegion: 'Select region',
    country: 'Country',
    selectCountry: 'Select country',
    countrySuggestions: 'Country suggestions',
    countryPlaceholder: '— Type Name —',
    timespan: 'Timespan',
    selectTimespan: 'Select timespan',
    search: 'Search',
    fullReset: 'Full reset',
    selectionActions: 'Selection actions',
    selectAll: 'Select all',
    selectAllVisible: 'Select all visible articles',
    share: 'Share',
    shareSelected: 'Share selected via native share or clipboard',
    export: 'Export',
    exportSelected: 'Download selected as HTML file',
    deselectAll: 'Deselect all',
    downloading: 'Downloading…',
    translating: 'Translating…',
    runSearchAbove: 'Run a search above.',
    filteredTo: 'Filtered to {country}',
    countryFilterCleared: 'Country filter cleared',
    nothingToSave: 'Nothing to save — run a search first.',
    defaultSaved: 'Default saved',
    storageUnavailable: 'Could not save — storage unavailable.',
    missingQuery: 'Please select a resource or enter a keyword.',
    selectedCount: '{count} selected',
    copiedToClipboard: 'Copied to clipboard',
    shareFailed: 'Could not share — try Export instead',
    articleSingular: 'article',
    articlePlural: 'articles',
    more: 'more',
    and: 'AND',
    or: 'OR',
    blankSelect: '— Select —',
    groupFossilFuels: 'Fossil Fuels',
    oil: 'Oil',
    lng: 'LNG / Natural Gas',
    coal: 'Coal',
    fossilFuelsBroad: 'Fossil Fuels',
    groupMining: 'Mining',
    miningBroad: 'Mining (broad)',
    gold: 'Gold',
    silver: 'Silver',
    copper: 'Copper',
    lithium: 'Lithium',
    cobalt: 'Cobalt',
    nickel: 'Nickel',
    ironOre: 'Iron Ore',
    uranium: 'Uranium',
    criticalMinerals: 'Critical Minerals',
    groupAgriculture: 'Agriculture / Land',
    palmOil: 'Palm Oil',
    soy: 'Soy',
    cattleBeef: 'Cattle / Beef',
    loggingTimber: 'Logging / Timber',
    africa: 'Africa',
    asia: 'Asia',
    europe: 'Europe',
    latinAmerica: 'Latin America',
    amazon: 'Amazon',
    middleEast: 'Middle East',
    northAmerica: 'North America',
    pacific: 'Pacific',
  },
  es: {
    pageTitle: 'NewsMapper 2.0 — Recursos Naturales', htmlLang: 'es', translateSelectorLabel: 'Traducir interfaz y titulares', topbarSub: 'Inteligencia de Recursos Naturales', topbarPowered: 'impulsado por GDELT', headlinesRegion: 'Titulares', hybridRegion: 'Mapa híbrido + titulares', searchQuery: 'Consulta de búsqueda', placeholderHtml: 'Seleccione un recurso y pulse <strong>Buscar</strong> para cargar titulares.', fetchingHeadlines: 'Cargando titulares…', cancel: 'Cancelar', emptyState: 'No se encontraron artículos. Pruebe otra consulta o un periodo más largo.', tryAgain: 'Intentar de nuevo', loadMore: 'Cargar más', hideMap: 'Ocultar mapa', showMap: 'Mostrar mapa', defaultBadge: '★ predeterminado', defaultBadgeAria: 'Cargado desde el valor predeterminado guardado', setDefault: 'Guardar pred.', saveCurrentQuery: 'Guardar la consulta actual como predeterminada', sortHeadlinesBy: 'Ordenar titulares', sortHybridHeadlinesBy: 'Ordenar titulares híbridos', newestFirst: 'Más recientes primero', oldestFirst: 'Más antiguos primero', select: 'Seleccionar', selectArticles: 'Seleccionar artículos para compartir o exportar', resource: 'Recurso', selectResource: 'Seleccionar recurso', region: 'Región', selectRegion: 'Seleccionar región', country: 'País', selectCountry: 'Seleccionar país', countrySuggestions: 'Sugerencias de países', countryPlaceholder: '— Escriba un nombre —', timespan: 'Periodo', selectTimespan: 'Seleccionar periodo', search: 'Buscar', fullReset: 'Reiniciar', selectionActions: 'Acciones de selección', selectAll: 'Seleccionar todo', selectAllVisible: 'Seleccionar todos los artículos visibles', share: 'Compartir', shareSelected: 'Compartir la selección', export: 'Exportar', exportSelected: 'Descargar la selección como HTML', deselectAll: 'Quitar selección', downloading: 'Descargando…', translating: 'Traduciendo…', runSearchAbove: 'Ejecute una búsqueda arriba.', filteredTo: 'Filtrado a {country}', countryFilterCleared: 'Filtro de país borrado', nothingToSave: 'Nada que guardar: ejecute primero una búsqueda.', defaultSaved: 'Predeterminado guardado', storageUnavailable: 'No se pudo guardar: almacenamiento no disponible.', missingQuery: 'Seleccione un recurso o introduzca una palabra clave.', selectedCount: '{count} seleccionados', copiedToClipboard: 'Copiado al portapapeles', shareFailed: 'No se pudo compartir; pruebe Exportar', articleSingular: 'artículo', articlePlural: 'artículos', more: 'más', and: 'Y', or: 'O', blankSelect: '— Seleccionar —', groupFossilFuels: 'Combustibles fósiles', oil: 'Petróleo', lng: 'GNL / Gas natural', coal: 'Carbón', fossilFuelsBroad: 'Combustibles fósiles', groupMining: 'Minería', miningBroad: 'Minería (general)', gold: 'Oro', silver: 'Plata', copper: 'Cobre', lithium: 'Litio', cobalt: 'Cobalto', nickel: 'Níquel', ironOre: 'Mineral de hierro', uranium: 'Uranio', criticalMinerals: 'Minerales críticos', groupAgriculture: 'Agricultura / Tierra', palmOil: 'Aceite de palma', soy: 'Soja', cattleBeef: 'Ganado / Carne', loggingTimber: 'Tala / Madera', africa: 'África', asia: 'Asia', europe: 'Europa', latinAmerica: 'América Latina', amazon: 'Amazonia', middleEast: 'Oriente Medio', northAmerica: 'América del Norte', pacific: 'Pacífico'
  },
  pt: {
    pageTitle: 'NewsMapper 2.0 — Recursos Naturais', htmlLang: 'pt', translateSelectorLabel: 'Traduzir interface e manchetes', topbarSub: 'Inteligência sobre Recursos Naturais', topbarPowered: 'alimentado por GDELT', headlinesRegion: 'Manchetes', hybridRegion: 'Mapa híbrido + manchetes', searchQuery: 'Consulta de busca', placeholderHtml: 'Selecione um recurso e clique em <strong>Buscar</strong> para carregar manchetes.', fetchingHeadlines: 'Carregando manchetes…', cancel: 'Cancelar', emptyState: 'Nenhum artigo encontrado. Tente outra consulta ou um período maior.', tryAgain: 'Tentar novamente', loadMore: 'Carregar mais', hideMap: 'Ocultar mapa', showMap: 'Mostrar mapa', defaultBadge: '★ padrão', defaultBadgeAria: 'Carregado do padrão salvo', setDefault: 'Salvar padrão', saveCurrentQuery: 'Salvar consulta atual como padrão', sortHeadlinesBy: 'Ordenar manchetes', sortHybridHeadlinesBy: 'Ordenar manchetes híbridas', newestFirst: 'Mais recentes primeiro', oldestFirst: 'Mais antigas primeiro', select: 'Selecionar', selectArticles: 'Selecionar artigos para compartilhar ou exportar', resource: 'Recurso', selectResource: 'Selecionar recurso', region: 'Região', selectRegion: 'Selecionar região', country: 'País', selectCountry: 'Selecionar país', countrySuggestions: 'Sugestões de países', countryPlaceholder: '— Digite um nome —', timespan: 'Período', selectTimespan: 'Selecionar período', search: 'Buscar', fullReset: 'Redefinir', selectionActions: 'Ações de seleção', selectAll: 'Selecionar tudo', selectAllVisible: 'Selecionar todos os artigos visíveis', share: 'Compartilhar', shareSelected: 'Compartilhar seleção', export: 'Exportar', exportSelected: 'Baixar seleção como HTML', deselectAll: 'Limpar seleção', downloading: 'Baixando…', translating: 'Traduzindo…', runSearchAbove: 'Faça uma busca acima.', filteredTo: 'Filtrado para {country}', countryFilterCleared: 'Filtro de país limpo', nothingToSave: 'Nada para salvar; execute uma busca primeiro.', defaultSaved: 'Padrão salvo', storageUnavailable: 'Não foi possível salvar; armazenamento indisponível.', missingQuery: 'Selecione um recurso ou insira uma palavra-chave.', selectedCount: '{count} selecionados', copiedToClipboard: 'Copiado para a área de transferência', shareFailed: 'Não foi possível compartilhar; tente Exportar', articleSingular: 'artigo', articlePlural: 'artigos', more: 'mais', and: 'E', or: 'OU', blankSelect: '— Selecionar —', groupFossilFuels: 'Combustíveis fósseis', oil: 'Petróleo', lng: 'GNL / Gás natural', coal: 'Carvão', fossilFuelsBroad: 'Combustíveis fósseis', groupMining: 'Mineração', miningBroad: 'Mineração (geral)', gold: 'Ouro', silver: 'Prata', copper: 'Cobre', lithium: 'Lítio', cobalt: 'Cobalto', nickel: 'Níquel', ironOre: 'Minério de ferro', uranium: 'Urânio', criticalMinerals: 'Minerais críticos', groupAgriculture: 'Agricultura / Terra', palmOil: 'Óleo de palma', soy: 'Soja', cattleBeef: 'Gado / Carne bovina', loggingTimber: 'Exploração madeireira', africa: 'África', asia: 'Ásia', europe: 'Europa', latinAmerica: 'América Latina', amazon: 'Amazônia', middleEast: 'Oriente Médio', northAmerica: 'América do Norte', pacific: 'Pacífico'
  },
  ru: {
    pageTitle: 'NewsMapper 2.0 — Природные ресурсы', htmlLang: 'ru', translateSelectorLabel: 'Перевести интерфейс и заголовки', topbarSub: 'Аналитика по природным ресурсам', topbarPowered: 'на базе GDELT', headlinesRegion: 'Заголовки', hybridRegion: 'Гибридная карта и заголовки', searchQuery: 'Поисковый запрос', placeholderHtml: 'Выберите ресурс и нажмите <strong>Поиск</strong>, чтобы загрузить заголовки.', fetchingHeadlines: 'Загрузка заголовков…', cancel: 'Отмена', emptyState: 'Статьи не найдены. Попробуйте другой запрос или больший период.', tryAgain: 'Повторить', loadMore: 'Загрузить ещё', hideMap: 'Скрыть карту', showMap: 'Показать карту', defaultBadge: '★ по умолчанию', defaultBadgeAria: 'Загружено из сохранённого значения по умолчанию', setDefault: 'Сделать осн.', saveCurrentQuery: 'Сохранить текущий запрос по умолчанию', sortHeadlinesBy: 'Сортировать заголовки', sortHybridHeadlinesBy: 'Сортировать гибридные заголовки', newestFirst: 'Сначала новые', oldestFirst: 'Сначала старые', select: 'Выбрать', selectArticles: 'Выбрать статьи для отправки или экспорта', resource: 'Ресурс', selectResource: 'Выбрать ресурс', region: 'Регион', selectRegion: 'Выбрать регион', country: 'Страна', selectCountry: 'Выбрать страну', countrySuggestions: 'Подсказки стран', countryPlaceholder: '— Введите название —', timespan: 'Период', selectTimespan: 'Выбрать период', search: 'Поиск', fullReset: 'Сброс', selectionActions: 'Действия с выбором', selectAll: 'Выбрать всё', selectAllVisible: 'Выбрать все видимые статьи', share: 'Поделиться', shareSelected: 'Поделиться выбранным', export: 'Экспорт', exportSelected: 'Скачать выбранное как HTML', deselectAll: 'Снять выбор', downloading: 'Загрузка…', translating: 'Перевод…', runSearchAbove: 'Выполните поиск выше.', filteredTo: 'Фильтр: {country}', countryFilterCleared: 'Фильтр по стране очищен', nothingToSave: 'Нечего сохранять — сначала выполните поиск.', defaultSaved: 'Значение по умолчанию сохранено', storageUnavailable: 'Не удалось сохранить — хранилище недоступно.', missingQuery: 'Выберите ресурс или введите ключевое слово.', selectedCount: 'Выбрано: {count}', copiedToClipboard: 'Скопировано в буфер обмена', shareFailed: 'Не удалось поделиться — попробуйте экспорт', articleSingular: 'статья', articlePlural: 'статей', more: 'ещё', and: 'И', or: 'ИЛИ', blankSelect: '— Выбрать —', groupFossilFuels: 'Ископаемое топливо', oil: 'Нефть', lng: 'СПГ / Природный газ', coal: 'Уголь', fossilFuelsBroad: 'Ископаемое топливо', groupMining: 'Добыча', miningBroad: 'Добыча (общая)', gold: 'Золото', silver: 'Серебро', copper: 'Медь', lithium: 'Литий', cobalt: 'Кобальт', nickel: 'Никель', ironOre: 'Железная руда', uranium: 'Уран', criticalMinerals: 'Критические минералы', groupAgriculture: 'Сельское хозяйство / Земля', palmOil: 'Пальмовое масло', soy: 'Соя', cattleBeef: 'Скот / Говядина', loggingTimber: 'Лесозаготовка', africa: 'Африка', asia: 'Азия', europe: 'Европа', latinAmerica: 'Латинская Америка', amazon: 'Амазония', middleEast: 'Ближний Восток', northAmerica: 'Северная Америка', pacific: 'Тихий океан'
  },
  'zh-CN': {
    pageTitle: 'NewsMapper 2.0 — 自然资源', htmlLang: 'zh-CN', translateSelectorLabel: '翻译界面和标题', topbarSub: '自然资源情报', topbarPowered: '由 GDELT 提供支持', headlinesRegion: '标题', hybridRegion: '混合地图与标题', searchQuery: '搜索查询', placeholderHtml: '选择一个资源并点击<strong>搜索</strong>以加载标题。', fetchingHeadlines: '正在获取标题…', cancel: '取消', emptyState: '未找到文章。请尝试其他查询或更长时间范围。', tryAgain: '重试', loadMore: '加载更多', hideMap: '隐藏地图', showMap: '显示地图', defaultBadge: '★ 默认', defaultBadgeAria: '已从保存的默认值加载', setDefault: '设为默认', saveCurrentQuery: '将当前查询保存为默认值', sortHeadlinesBy: '标题排序', sortHybridHeadlinesBy: '混合标题排序', newestFirst: '最新优先', oldestFirst: '最早优先', select: '选择', selectArticles: '选择文章以分享或导出', resource: '资源', selectResource: '选择资源', region: '地区', selectRegion: '选择地区', country: '国家', selectCountry: '选择国家', countrySuggestions: '国家建议', countryPlaceholder: '— 输入名称 —', timespan: '时间范围', selectTimespan: '选择时间范围', search: '搜索', fullReset: '完全重置', selectionActions: '选择操作', selectAll: '全选', selectAllVisible: '选择所有可见文章', share: '分享', shareSelected: '分享已选内容', export: '导出', exportSelected: '将已选内容下载为 HTML', deselectAll: '取消全选', downloading: '下载中…', translating: '翻译中…', runSearchAbove: '请先在上方搜索。', filteredTo: '已筛选到 {country}', countryFilterCleared: '国家筛选已清除', nothingToSave: '没有可保存的内容，请先执行搜索。', defaultSaved: '默认值已保存', storageUnavailable: '无法保存，存储不可用。', missingQuery: '请选择资源或输入关键词。', selectedCount: '已选择 {count} 项', copiedToClipboard: '已复制到剪贴板', shareFailed: '无法分享，请尝试导出', articleSingular: '篇文章', articlePlural: '篇文章', more: '更多', and: '且', or: '或', blankSelect: '— 选择 —', groupFossilFuels: '化石燃料', oil: '石油', lng: '液化天然气 / 天然气', coal: '煤炭', fossilFuelsBroad: '化石燃料', groupMining: '采矿', miningBroad: '采矿（广义）', gold: '黄金', silver: '白银', copper: '铜', lithium: '锂', cobalt: '钴', nickel: '镍', ironOre: '铁矿石', uranium: '铀', criticalMinerals: '关键矿产', groupAgriculture: '农业 / 土地', palmOil: '棕榈油', soy: '大豆', cattleBeef: '牛 / 牛肉', loggingTimber: '伐木 / 木材', africa: '非洲', asia: '亚洲', europe: '欧洲', latinAmerica: '拉丁美洲', amazon: '亚马孙', middleEast: '中东', northAmerica: '北美', pacific: '太平洋'
  },
};

function getUiText(language = currentUiLanguage) {
  return UI_TEXT[language] || UI_TEXT.en;
}

function t(key, vars = {}, language = currentUiLanguage) {
  const copy = getUiText(language);
  let text = copy[key] ?? UI_TEXT.en[key] ?? '';
  return text.replace(/\{(\w+)\}/g, (_, token) => String(vars[token] ?? ''));
}

function setTextContent(node, text) {
  if (node) node.textContent = text;
}

function setInnerHtml(node, html) {
  if (node) node.innerHTML = html;
}

function setElementText(id, text) {
  const node = el(id);
  if (!node) return;
  if (!node.querySelector('svg')) {
    node.textContent = text;
    return;
  }
  const textNodes = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE);
  if (textNodes.length) {
    textNodes[textNodes.length - 1].textContent = ` ${text}`;
    return;
  }
  node.append(document.createTextNode(` ${text}`));
}

function setElementAttr(id, name, value) {
  const node = el(id);
  if (node) node.setAttribute(name, value);
}

function updateLanguageSelectorLabels() {
  const select = el('languageSelect');
  if (!select) return;
  [...select.options].forEach(option => {
    option.textContent = LANGUAGE_OPTION_LABELS[option.value] || option.textContent;
  });
}

function applySelectOptionLabels() {
  const resourceSelect = el('resourceSelect');
  if (resourceSelect) {
    const groups = resourceSelect.querySelectorAll('optgroup');
    if (groups[0]) groups[0].label = t('groupFossilFuels');
    if (groups[1]) groups[1].label = t('groupMining');
    if (groups[2]) groups[2].label = t('groupAgriculture');
    const labelByValue = {
      '': t('blankSelect'),
      Oil: t('oil'),
      LNG: t('lng'),
      Coal: t('coal'),
      'Fossil Fuels': t('fossilFuelsBroad'),
      Mining: t('miningBroad'),
      Gold: t('gold'),
      Silver: t('silver'),
      Copper: t('copper'),
      Lithium: t('lithium'),
      Cobalt: t('cobalt'),
      Nickel: t('nickel'),
      Iron: t('ironOre'),
      Uranium: t('uranium'),
      'Critical Minerals': t('criticalMinerals'),
      'Palm Oil': t('palmOil'),
      Soy: t('soy'),
      'Cattle/Beef': t('cattleBeef'),
      Logging: t('loggingTimber'),
    };
    [...resourceSelect.options].forEach(option => {
      option.textContent = labelByValue[option.value] ?? option.textContent;
    });
  }

  const regionSelect = el('regionSelect');
  if (regionSelect) {
    const labelByValue = {
      '': t('blankSelect'),
      Africa: t('africa'),
      Asia: t('asia'),
      Europe: t('europe'),
      'Latin America': t('latinAmerica'),
      Amazon: t('amazon'),
      'Middle East': t('middleEast'),
      'North America': t('northAmerica'),
      Pacific: t('pacific'),
    };
    [...regionSelect.options].forEach(option => {
      option.textContent = labelByValue[option.value] ?? option.textContent;
    });
  }
}

function applyUiLanguage(language) {
  currentUiLanguage = getUiText(normalizeTranslateLanguage(language)).htmlLang === 'zh-CN' ? 'zh-CN' : normalizeTranslateLanguage(language);
  if (!UI_TEXT[currentUiLanguage]) currentUiLanguage = 'en';

  document.documentElement.lang = getUiText().htmlLang;
  document.title = t('pageTitle');

  updateLanguageSelectorLabels();
  const selectorLabel = document.querySelector('label[for="languageSelect"].sr-only');
  setTextContent(selectorLabel, t('translateSelectorLabel'));
  setElementAttr('languageSelect', 'aria-label', t('translateSelectorLabel'));

  setTextContent(document.querySelector('.topbar-sub'), t('topbarSub'));
  setTextContent(document.querySelector('.topbar-powered'), t('topbarPowered'));
  setElementAttr('viewHeadlines', 'aria-label', t('headlinesRegion'));
  setElementAttr('viewHybrid', 'aria-label', t('hybridRegion'));
  setElementAttr('queryPanel', 'aria-label', t('searchQuery'));

  setElementText('mapToggleBtn', t('hideMap'));
  setElementAttr('mapToggleBtn', 'title', t('hideMap'));

  setElementText('defaultBadge', t('defaultBadge'));
  setElementAttr('defaultBadge', 'aria-label', t('defaultBadgeAria'));
  setElementText('setDefaultBtn', t('setDefault'));
  setElementText('hybridSetDefaultBtn', t('setDefault'));
  setElementAttr('setDefaultBtn', 'title', t('saveCurrentQuery'));
  setElementAttr('setDefaultBtn', 'aria-label', t('saveCurrentQuery'));
  setElementAttr('hybridSetDefaultBtn', 'title', t('saveCurrentQuery'));
  setElementAttr('hybridSetDefaultBtn', 'aria-label', t('saveCurrentQuery'));

  setTextContent(document.querySelector('label[for="hlSortSelect"].sr-only'), t('sortHeadlinesBy'));
  setTextContent(document.querySelector('label[for="hybridSortSelect"].sr-only'), t('sortHybridHeadlinesBy'));
  setElementAttr('hlSortSelect', 'aria-label', t('sortHeadlinesBy'));
  setElementAttr('hybridSortSelect', 'aria-label', t('sortHybridHeadlinesBy'));
  const hlSortOptions = el('hlSortSelect')?.options;
  if (hlSortOptions?.[0]) hlSortOptions[0].textContent = t('newestFirst');
  if (hlSortOptions?.[1]) hlSortOptions[1].textContent = t('oldestFirst');
  const hybridSortOptions = el('hybridSortSelect')?.options;
  if (hybridSortOptions?.[0]) hybridSortOptions[0].textContent = t('newestFirst');
  if (hybridSortOptions?.[1]) hybridSortOptions[1].textContent = t('oldestFirst');

  setElementText('hlSelectBtn', t('select'));
  setElementText('hybridSelectBtn', t('select'));
  setElementAttr('hlSelectBtn', 'title', t('selectArticles'));
  setElementAttr('hybridSelectBtn', 'title', t('selectArticles'));

  setElementText('lblResource', t('resource'));
  setElementText('lblRegion', t('region'));
  setElementText('lblCountry', t('country'));
  setElementText('lblTimespan', t('timespan'));
  setElementText('lblSearch', t('search'));
  setTextContent(document.querySelector('.qp-and'), t('and'));
  setTextContent(document.querySelector('.qp-or'), t('or'));
  setElementAttr('resourceSelect', 'aria-label', t('selectResource'));
  setElementAttr('regionSelect', 'aria-label', t('selectRegion'));
  setElementAttr('countryInput', 'aria-label', t('selectCountry'));
  setElementAttr('countrySuggest', 'aria-label', t('countrySuggestions'));
  setElementAttr('countryInput', 'placeholder', t('countryPlaceholder'));
  const timeBtns = document.querySelector('.qp-time-btns');
  if (timeBtns) timeBtns.setAttribute('aria-label', t('selectTimespan'));
  setElementAttr('searchBtn', 'title', t('search'));
  setElementAttr('searchBtn', 'aria-label', t('search'));
  setElementAttr('resetBtn', 'title', t('fullReset'));
  setElementAttr('resetBtn', 'aria-label', t('fullReset'));

  setElementAttr('selBar', 'aria-label', t('selectionActions'));
  setElementText('selSelectAllBtn', t('selectAll'));
  setElementAttr('selSelectAllBtn', 'title', t('selectAllVisible'));
  setElementText('selShareBtn', t('share'));
  setElementAttr('selShareBtn', 'title', t('shareSelected'));
  setElementText('selExportBtn', t('export'));
  setElementAttr('selExportBtn', 'title', t('exportSelected'));
  setElementAttr('selClearBtn', 'title', t('deselectAll'));
  setElementAttr('selClearBtn', 'aria-label', t('deselectAll'));

  applySelectOptionLabels();

  setUiStrings({
    placeholderHtml: t('placeholderHtml'),
    fetchingHeadlines: t('fetchingHeadlines'),
    cancel: t('cancel'),
    emptyState: t('emptyState'),
    failedToLoadPrefix: currentUiLanguage === 'es' ? 'Error al cargar:' : currentUiLanguage === 'pt' ? 'Falha ao carregar:' : currentUiLanguage === 'ru' ? 'Ошибка загрузки:' : currentUiLanguage === 'zh-CN' ? '加载失败：' : 'Failed to load:',
    tryAgain: t('tryAgain'),
    loadMore: t('loadMore'),
    articleSingular: t('articleSingular'),
    articlePlural: t('articlePlural'),
    cached: currentUiLanguage === 'zh-CN' ? '缓存' : currentUiLanguage === 'ru' ? 'кэш' : currentUiLanguage === 'es' ? 'en caché' : currentUiLanguage === 'pt' ? 'em cache' : 'cached',
    lessThanOne: '<1',
    minuteShort: currentUiLanguage === 'ru' ? 'м' : currentUiLanguage === 'zh-CN' ? '分' : 'm',
    requestTimedOut: currentUiLanguage === 'es' ? 'La solicitud de titulares agotó el tiempo de espera. GDELT puede estar lento o limitando la tasa.' : currentUiLanguage === 'pt' ? 'A solicitação das manchetes expirou. O GDELT pode estar lento ou limitando requisições.' : currentUiLanguage === 'ru' ? 'Время ожидания запроса заголовков истекло. GDELT может отвечать медленно или ограничивать запросы.' : currentUiLanguage === 'zh-CN' ? '标题请求超时。GDELT 可能较慢或正在限流。' : 'Headline request timed out. GDELT may be slow or rate-limiting. Please try again.',
    unableLoadHeadlines: currentUiLanguage === 'es' ? 'No es posible cargar los titulares ahora mismo. Inténtelo de nuevo.' : currentUiLanguage === 'pt' ? 'Não foi possível carregar as manchetes agora. Tente novamente.' : currentUiLanguage === 'ru' ? 'Сейчас не удалось загрузить заголовки. Повторите попытку.' : currentUiLanguage === 'zh-CN' ? '目前无法加载标题，请重试。' : 'Unable to load headlines right now. Please try again.',
    rateLimited: currentUiLanguage === 'es' ? 'GDELT está limitando las solicitudes en este momento. Espere un momento y vuelva a intentarlo.' : currentUiLanguage === 'pt' ? 'O GDELT está limitando as requisições agora. Aguarde um momento e tente novamente.' : currentUiLanguage === 'ru' ? 'GDELT сейчас ограничивает запросы. Подождите немного и повторите попытку.' : currentUiLanguage === 'zh-CN' ? 'GDELT 当前正在限流。请稍后再试。' : 'GDELT is rate-limiting requests right now. Wait a moment and retry.',
  });

  setMapUiStrings({
    articleSingular: t('articleSingular'),
    articlePlural: t('articlePlural'),
    more: t('more'),
  });

  updateSelBar(getSelectedArticles().length);
  updateViewStatus('hybrid', getDisplayArticles().length);
  if (currentView === 'hybrid') {
    updateHybridMap(getMapArticles(), getCountryFilter());
    renderHybridList(getDisplayArticles());
  }
}

function countryLabelFromKey(key) {
  return String(key)
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function hydrateCountrySelect() {
  countryNames = [...new Set(Object.keys(COUNTRY_COORDS).map(countryLabelFromKey))].sort((a, b) => a.localeCompare(b));
}

function hideCountrySuggestions() {
  const box = el('countrySuggest');
  if (!box) return;
  box.hidden = true;
  box.innerHTML = '';
  box.style.left = '';
  box.style.top = '';
  box.style.width = '';
  box.style.maxHeight = '';
  activeCountrySuggestion = -1;
}

function positionCountrySuggestions() {
  const box = el('countrySuggest');
  const input = el('countryInput');
  if (!box || !input || box.hidden) return;
  const rect = input.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const spaceBelow = Math.max(120, viewportHeight - rect.bottom - 12);
  box.style.left = `${Math.round(rect.left)}px`;
  box.style.top = `${Math.round(rect.bottom + 4)}px`;
  box.style.width = `${Math.round(rect.width)}px`;
  box.style.maxHeight = `${Math.round(spaceBelow)}px`;
}

function applyCountrySuggestion(value) {
  const input = el('countryInput');
  if (!input) return;
  input.value = value;
  hideCountrySuggestions();
}

function highlightCountrySuggestion(index) {
  const box = el('countrySuggest');
  if (!box || box.hidden) return;
  const items = [...box.querySelectorAll('.country-suggest-item')];
  items.forEach((node, i) => node.classList.toggle('active', i === index));
}

function showCountrySuggestions(query) {
  const box = el('countrySuggest');
  if (!box) return;
  const q = String(query || '').trim().toLowerCase();
  if (!q) { hideCountrySuggestions(); return; }
  const matches = countryNames.filter(name => name.toLowerCase().startsWith(q))
    .concat(countryNames.filter(name => !name.toLowerCase().startsWith(q) && name.toLowerCase().includes(q)))
    .slice(0, 12);
  if (!matches.length) { hideCountrySuggestions(); return; }
  activeCountrySuggestion = -1;
  box.innerHTML = matches.map((name, idx) => `<button type="button" class="country-suggest-item" data-idx="${idx}" data-country="${esc(name)}">${esc(name)}</button>`).join('');
  box.hidden = false;
  positionCountrySuggestions();
}

function moveCountrySuggestion(delta) {
  const box = el('countrySuggest');
  if (!box || box.hidden) return;
  const items = [...box.querySelectorAll('.country-suggest-item')];
  if (!items.length) return;
  activeCountrySuggestion = (activeCountrySuggestion + delta + items.length) % items.length;
  highlightCountrySuggestion(activeCountrySuggestion);
}

function chooseActiveCountrySuggestion() {
  const box = el('countrySuggest');
  if (!box || box.hidden) return false;
  const items = [...box.querySelectorAll('.country-suggest-item')];
  if (!items.length) return false;
  const idx = activeCountrySuggestion >= 0 ? activeCountrySuggestion : 0;
  const item = items[idx];
  if (!item) return false;
  applyCountrySuggestion(item.dataset.country || item.textContent || '');
  return true;
}

function showToast(msg, ms = 2500) {
  const t = el('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('toast-visible');
  setTimeout(() => t.classList.remove('toast-visible'), ms);
}

let _hybridRetryTimeout = null;

function clearHybridRetry() {
  if (_hybridRetryTimeout) { clearTimeout(_hybridRetryTimeout); _hybridRetryTimeout = null; }
}

function setHybridStatus(state, { msg = '', retryIn = 0, onRetry = null } = {}) {
  const container = el('hybridHeadlines');
  if (!container) return;
  clearHybridRetry();
  _hybridStatusActive = !!state;
  if (!state) { container.innerHTML = ''; return; }

  const isError = state === 'error';
  const statusMsg = msg || (state === 'downloading' ? t('downloading') : t('translating'));

  let countdownHtml = '';
  let retryBtnHtml  = '';
  if (isError && retryIn > 0) {
    countdownHtml = `<span class="hybrid-status-countdown" id="hybridRetryCountdown">${retryIn}s</span>`;
    retryBtnHtml  = `<button class="hybrid-retry-btn" id="hybridRetryNowBtn">${t('tryAgain')}</button>`;
  }

  container.innerHTML = `
    <div class="hybrid-status">
      <div class="hybrid-progress-track">
        <div class="hybrid-progress-bar${isError ? ' error' : ''}" id="hybridProgressBar"></div>
      </div>
      <div class="hybrid-status-row">
        <span class="hybrid-status-msg">${statusMsg}</span>
        ${countdownHtml}
      </div>
      ${retryBtnHtml}
    </div>`;

  const bar = el('hybridProgressBar');
  if (bar) {
    if (isError) {
      bar.style.width = '100%';
    } else {
      requestAnimationFrame(() => { bar.style.width = '60%'; });
      setTimeout(() => { if (bar.isConnected) bar.style.width = '85%'; }, 3000);
    }
  }

  if (isError && retryIn > 0 && onRetry) {
    let remaining = retryIn;
    const tick = () => {
      remaining--;
      const cdEl = el('hybridRetryCountdown');
      if (cdEl) cdEl.textContent = `${remaining}s`;
      if (remaining > 0) {
        _hybridRetryTimeout = setTimeout(tick, 1000);
      } else {
        onRetry();
      }
    };
    _hybridRetryTimeout = setTimeout(tick, 1000);

    el('hybridRetryNowBtn')?.addEventListener('click', () => {
      clearHybridRetry();
      onRetry();
    });
  }
}

function setSearchLoading(on) {
  const btn = el('searchBtn');
  if (!btn) return;
  btn.classList.toggle('loading', !!on);
  btn.setAttribute('aria-busy', String(!!on));
  btn.disabled = !!on;
}

async function runQuery(query, timespan) {
  setSearchLoading(true);
  clearHybridRetry();
  let attempt = 0;
  const MAX_ATTEMPTS = 2;
  const DELAY_MS = 10000;

  const doAttempt = async () => {
    attempt++;
    setHybridStatus('downloading');
    const delayMs = attempt === 1 ? 0 : DELAY_MS;
    if (delayMs > 0) {
      await new Promise(resolve => {
        const bar = el('hybridProgressBar');
        if (bar) {
          requestAnimationFrame(() => { bar.style.transition = `width ${delayMs}ms linear`; bar.style.width = '90%'; });
        }
        setTimeout(resolve, delayMs);
      });
    }
    const bar = el('hybridProgressBar');
    if (bar) { bar.style.transition = 'width 0.3s ease'; bar.style.width = '95%'; }

    try {
      await fetchAndRender(query, timespan);
      if (bar && bar.isConnected) { bar.style.width = '100%'; }
      if (currentUiLanguage !== 'en') {
        const TRANSLATE_DELAY = 4000;
        await new Promise(resolve => {
          _pendingTranslateResolve = resolve;
          setHybridStatus('translating');
          const tBar = el('hybridProgressBar');
          if (tBar) {
            requestAnimationFrame(() => { tBar.style.transition = `width ${TRANSLATE_DELAY}ms linear`; tBar.style.width = '90%'; });
          }
          setTimeout(() => {
            if (_pendingTranslateResolve === resolve) {
              _pendingTranslateResolve = null;
              resolve();
            }
          }, TRANSLATE_DELAY);
        });
        _pendingTranslateResolve = null;
      }
      if (currentView === 'hybrid') renderHybridList(getVisibleArticles());
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        setHybridStatus('error', {
          msg: t('requestTimedOut') || 'Request failed. Retrying…',
          retryIn: 10,
          onRetry: doAttempt,
        });
      } else {
        setHybridStatus('error', { msg: t('unableLoadHeadlines') || 'Unable to load. Please retry.' });
        if (currentView === 'hybrid') renderHybridList(getVisibleArticles());
      }
    }
  };

  try {
    if (hasCachedData(query, timespan)) {
      await fetchAndRender(query, timespan);
      if (currentView === 'hybrid') renderHybridList(getVisibleArticles());
    } else {
      await doAttempt();
    }
  } finally {
    setSearchLoading(false);
  }
}

function relocateQueryPanel(view) {
  const panel = el('queryPanel');
  const hybridDock = el('hybridQueryDock');
  const defaultDock = el('queryPanelDock');
  if (!panel || !hybridDock || !defaultDock) return;
  const targetDock = view === 'hybrid' ? hybridDock : defaultDock;
  if (panel.parentElement !== targetDock) targetDock.appendChild(panel);
}

function switchView(view) {
  currentView = view;
  relocateQueryPanel(view);
  relocateSelBar(view);
  qsa('.view-btn').forEach(b => {
    const on = b.dataset.view === view;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
  });
  qsa('.view-panel').forEach(p => {
    const on = p.id === `view${view[0].toUpperCase()}${view.slice(1)}`;
    p.classList.toggle('active', on);
  });
  const th = el('toolbarHeadlines'), thh = el('toolbarHybrid');
  if (th)  th.style.display  = view === 'headlines' ? '' : 'none';
  if (thh) thh.style.display = view === 'hybrid'    ? '' : 'none';
  if (view === 'hybrid') showHybrid();
}

function renderHybridList(articles) {
  _hybridStatusActive = false;
  const container = el('hybridHeadlines');
  if (!container) return;
  if (!articles.length) {
    container.innerHTML = `<p class="hybrid-empty">${t('runSearchAbove')}</p>`;
    return;
  }
  container.innerHTML = buildArticleRowsHtml(articles);
  container.classList.toggle('select-mode', selectModeOn);
}

function showHybrid() {
  initHybridMap('hybridMapContainer');
  const rawArts = getMapArticles();
  const displayArts = getDisplayArticles();
  const visibleArts = getVisibleArticles();
  updateHybridMap(rawArts, getCountryFilter());
  renderHybridList(visibleArts);
  updateViewStatus('hybrid', displayArts.length);
}

function updateViewStatus(view, count) {
  if (view !== 'hybrid') return;
  const hc = el('hybridHlCount');
  if (hc) {
    const c = Number(count) || 0;
    const filter = getCountryFilter();
    const suffix = filter ? ` · ${filter}` : '';
    hc.textContent = `${c.toLocaleString()} ${c === 1 ? t('articleSingular') : t('articlePlural')}${suffix}`;
  }
}

function applyCountryFilterFromMap(country) {
  const raw = String(country || '').trim();
  if (!raw) return;
  setCountryFilter(raw);
  const input = el('countryInput');
  if (input) input.value = raw;
  showToast(t('filteredTo', { country: raw }));
}

function applyTranslate(enabled) {
  const changed = translateEnabled !== enabled;
  translateEnabled = enabled;
  if (changed) setTranslateEnabled(enabled);
  el('languageSelect')?.classList.toggle('active', enabled);
}

function applyTranslationLanguage(language) {
  const normalized = normalizeTranslateLanguage(language);
  const select = el('languageSelect');
  if (select) select.value = normalized;
  applyUiLanguage(normalized);
  setTranslateLanguage(normalized);
  applyTranslate(true);
}

function readFormParams() {
  return {
    resource: el('resourceSelect')?.value ?? '',
    region:   el('regionSelect')?.value   ?? '',
    country:  el('countryInput')?.value   ?? '',
  };
}

function setActiveTimespanBtn(ts) {
  qsa('.time-btn').forEach(b => {
    const on = b.dataset.timespan === ts;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
  });
  currentTimespan = ts;
}

function loadStoredDefault() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}

function saveDefault() {
  const p = readFormParams();
  if (!buildQuery(p)) { showToast(t('nothingToSave')); return; }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      resource: p.resource, region: p.region, country: p.country, timespan: currentTimespan,
    }));
    showToast(t('defaultSaved'));
    el('setDefaultBtn')?.classList.add('saved');
  } catch { showToast(t('storageUnavailable')); }
}

function showDefaultBadge(visible) {
  const badge = el('defaultBadge');
  if (badge) badge.style.display = visible ? 'inline-flex' : 'none';
  if (!visible) el('setDefaultBtn')?.classList.remove('saved');
}

async function doSearch() {
  const params = readFormParams(), query = buildQuery(params);
  if (!query) { showToast(t('missingQuery')); return; }
  lastBuiltQuery = query;
  showDefaultBadge(false);
  await runQuery(query, currentTimespan);
  const url = new URL(window.location.href);
  params.resource ? url.searchParams.set('r', params.resource) : url.searchParams.delete('r');
  params.region   ? url.searchParams.set('rg', params.region)  : url.searchParams.delete('rg');
  params.country  ? url.searchParams.set('c', params.country)  : url.searchParams.delete('c');
  url.searchParams.set('t', currentTimespan);
  window.history.replaceState({}, '', url.toString());
}

function restoreFromURL() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('r')  && el('resourceSelect')) el('resourceSelect').value = p.get('r');
  if (p.get('rg') && el('regionSelect'))   el('regionSelect').value   = p.get('rg');
  if (p.get('c')  && el('countryInput'))   el('countryInput').value   = p.get('c');
  if (p.get('t')) setActiveTimespanBtn(p.get('t'));
  if (p.get('r') || p.get('c')) { doSearch(); return; }
  const dflt = loadStoredDefault();
  if (dflt) {
    if (dflt.resource && el('resourceSelect')) el('resourceSelect').value = dflt.resource;
    if (dflt.region   && el('regionSelect'))   el('regionSelect').value   = dflt.region;
    if (dflt.country  && el('countryInput'))   el('countryInput').value   = dflt.country;
    setActiveTimespanBtn(dflt.timespan || '7d');
    const q = buildQuery(readFormParams());
    if (q) { lastBuiltQuery = q; showDefaultBadge(true); runQuery(q, currentTimespan); }
  }
}

function updateSelBar(count) {
  const bar = el('selBar');
  if (bar) bar.classList.toggle('sel-bar-visible', selectModeOn);
  const lbl = el('selBarCount'); if (lbl) lbl.textContent = t('selectedCount', { count });
}

function relocateSelBar(view) {
  const bar = el('selBar');
  if (!bar) return;
  if (view === 'hybrid') {
    const dock = el('hybridHeadlines');
    if (dock && bar.nextSibling !== dock) dock.parentElement?.insertBefore(bar, dock);
  } else {
    const dock = el('hlGrid');
    if (dock && bar.nextSibling !== dock) dock.parentElement?.insertBefore(bar, dock);
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function shareSelected() {
  const arts = getSelectedArticles(); if (!arts.length) return;
  const header = `${arts.length} article${arts.length === 1 ? '' : 's'} on: ${lastBuiltQuery}`;
  const lines  = arts.map((a, i) => `${i + 1}. ${a.title}\n   ${a.url}`).join('\n\n');
  const payload = arts.length === 1
    ? { title: arts[0].title, text: `${header}\n\n${arts[0].title}`, url: arts[0].url }
    : { title: `NewsMapper — ${lastBuiltQuery}`, text: `${header}\n\n${lines}` };
  const canShare = typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare(payload));
  if (canShare) {
    try { await navigator.share(payload); return; }
    catch (e) { if (e?.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(arts.length === 1 ? `${arts[0].title}\n${arts[0].url}` : `${payload.title}\n\n${lines}`);
    showToast(t('copiedToClipboard'));
  } catch { showToast(t('shareFailed')); }
}

function exportSelectedHtml() {
  const arts = getSelectedArticles(); if (!arts.length) return;
  const rows = arts.map((a, i) => `\n    <li><a href="${esc(a.url)}" target="_blank">${esc(a.title)}</a><div class="meta">${[a.country,a.domain,a.date].filter(Boolean).map(esc).join(' &middot; ')}</div></li>`).join('');
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NewsMapper — ${esc(lastBuiltQuery)}</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:2rem auto;padding:0 1rem;color:#1a1d2e;line-height:1.5}h1{font-size:1.1rem;color:#2a52be;margin-bottom:.2rem}.sub{font-size:.8rem;color:#888;margin:0 0 1.5rem}ol{padding-left:1.3rem}li{margin-bottom:1rem}a{color:#2a52be;font-weight:600;text-decoration:none}a:hover{text-decoration:underline}.meta{font-size:.75rem;color:#888;margin-top:.2rem}</style></head><body><h1>NewsMapper — ${esc(lastBuiltQuery)}</h1><p class="sub">${arts.length} article${arts.length===1?'':'s'} &middot; exported ${new Date().toLocaleString()}</p><ol>${rows}\n</ol></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `newsmapper-${lastBuiltQuery.replace(/[^a-z0-9]+/gi,'-').toLowerCase().slice(0,40)}.html`;
  a.click(); URL.revokeObjectURL(a.href);
}

function fullPageReset() {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.location.assign(cleanUrl);
}

function wireEvents() {
  qsa('.view-btn[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  el('mapToggleBtn')?.addEventListener('click', () => {
    const container = el('hybridMapContainer');
    if (!container) return;
    const hidden = container.style.display === 'none';
    container.style.display = hidden ? '' : 'none';
    setElementText('mapToggleBtn', hidden ? t('hideMap') : t('showMap'));
    setElementAttr('mapToggleBtn', 'title', hidden ? t('hideMap') : t('showMap'));
    el('mapToggleBtn')?.setAttribute('aria-pressed', String(!hidden));
  });
  el('languageSelect')?.addEventListener('change', e => applyTranslationLanguage(e.target.value));
  qsa('.time-btn').forEach(b => b.addEventListener('click', () => {
    const ts = b.dataset.timespan; setActiveTimespanBtn(ts);
    const hs = el('hybridSortSelect'); if (hs) hs.value = el('hlSortSelect')?.value || 'date-desc';
    if (lastBuiltQuery) runQuery(lastBuiltQuery, ts);
  }));
  el('setDefaultBtn')?.addEventListener('click', saveDefault);
  el('hybridSetDefaultBtn')?.addEventListener('click', saveDefault);
  el('hlSelectBtn')?.addEventListener('click', () => {
    selectModeOn = !selectModeOn;
    toggleSelectMode(selectModeOn);
    el('hlSelectBtn')?.classList.toggle('active', selectModeOn);
    el('hlSelectBtn')?.setAttribute('aria-pressed', String(selectModeOn));
    el('hybridSelectBtn')?.classList.toggle('active', selectModeOn);
    el('hybridSelectBtn')?.setAttribute('aria-pressed', String(selectModeOn));
    updateSelBar(selectModeOn ? getSelectedArticles().length : 0);
  });
  el('hybridSelectBtn')?.addEventListener('click', () => {
    selectModeOn = !selectModeOn;
    toggleSelectMode(selectModeOn);
    el('hlSelectBtn')?.classList.toggle('active', selectModeOn);
    el('hlSelectBtn')?.setAttribute('aria-pressed', String(selectModeOn));
    el('hybridSelectBtn')?.classList.toggle('active', selectModeOn);
    el('hybridSelectBtn')?.setAttribute('aria-pressed', String(selectModeOn));
    updateSelBar(selectModeOn ? getSelectedArticles().length : 0);
  });
  el('selSelectAllBtn')?.addEventListener('click', selectAll);
  el('selShareBtn')?.addEventListener('click', shareSelected);
  el('selExportBtn')?.addEventListener('click', exportSelectedHtml);
  el('selClearBtn')?.addEventListener('click', () => { clearSelection(); updateSelBar(0); });
  setSelectionChangeCallback(count => updateSelBar(count));
  el('searchBtn')?.addEventListener('click', () => { void doSearch(); });
  el('resetBtn')?.addEventListener('click', fullPageReset);
  const countryInput = el('countryInput');
  const countrySuggest = el('countrySuggest');
  countryInput?.addEventListener('input', e => showCountrySuggestions(e.target.value));
  countryInput?.addEventListener('focus', e => { if (e.target.value) showCountrySuggestions(e.target.value); });
  countryInput?.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCountrySuggestion(1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); moveCountrySuggestion(-1); return; }
    if (e.key === 'Escape')    { hideCountrySuggestions(); return; }
    if (e.key === 'Enter') {
      if (chooseActiveCountrySuggestion()) e.preventDefault();
      void doSearch();
    }
  });
  countryInput?.addEventListener('blur', () => setTimeout(hideCountrySuggestions, 150));
  countrySuggest?.addEventListener('mousedown', e => e.preventDefault());
  countrySuggest?.addEventListener('click', e => {
    const btn = e.target.closest('.country-suggest-item');
    if (!btn) return;
    applyCountrySuggestion(btn.dataset.country || btn.textContent || '');
  });
  window.addEventListener('resize', positionCountrySuggestions);
  window.addEventListener('scroll', positionCountrySuggestions, true);
  el('hlSortSelect')?.addEventListener('change', e => {
    const value = e.target.value;
    const hs = el('hybridSortSelect'); if (hs) hs.value = value;
    setSortOrder(value);
  });
  el('hybridSortSelect')?.addEventListener('change', e => {
    const value = e.target.value;
    const hs = el('hlSortSelect'); if (hs) hs.value = value;
    setSortOrder(value);
  });
  el('hlLoadMoreBtn')?.addEventListener('click', loadMore);
  el('hybridLoadMoreBtn')?.addEventListener('click', loadMore);
  el('hlRetryBtn')?.addEventListener('click', () => { if (lastBuiltQuery) runQuery(lastBuiltQuery, currentTimespan); });
}

function setupPullToRefresh() {
  let startY = 0, mayPull = false;
  document.addEventListener('touchstart', e => {
    const grid = el('hlGrid');
    mayPull = (grid ? grid.scrollTop : 0) === 0;
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!mayPull) return;
    if (e.changedTouches[0].clientY - startY > 90) window.location.reload(true);
  }, { passive: true });
}

function isPageReload() {
  const nav = performance.getEntriesByType('navigation');
  if (Array.isArray(nav) && nav[0] && typeof nav[0].type === 'string') {
    return nav[0].type === 'reload';
  }
  return typeof performance.navigation !== 'undefined' && performance.navigation.type === 1;
}

document.addEventListener('DOMContentLoaded', () => {
  hydrateCountrySelect();
  wireEvents();
  applyTranslationLanguage(el('languageSelect')?.value || 'en');
  setMapCountryClickHandler(({ country }) => applyCountryFilterFromMap(country));
  setOnRenderCallback(articles => {
    updateViewStatus('hybrid', getDisplayArticles().length);
    if (currentView === 'hybrid') { updateHybridMap(getMapArticles(), getCountryFilter()); renderHybridList(getVisibleArticles()); }
  });
  setOnTranslateCallback(state => {
    if (state === 'end' && _pendingTranslateResolve) {
      const res = _pendingTranslateResolve;
      _pendingTranslateResolve = null;
      res();
    }
  });
  setupPullToRefresh();
  switchView('hybrid');
  if (isPageReload()) {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    if (window.location.search) window.history.replaceState({}, '', cleanUrl);
      return;
  }
  restoreFromURL();
});  
