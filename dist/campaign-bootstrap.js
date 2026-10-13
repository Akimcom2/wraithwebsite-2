(() => {
  'use strict';
  const defaults = window.CAMPAIGN_CONFIG || {};
  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Не удалось загрузить ' + src));
    document.body.append(script);
  });
  (async () => {
    try {
      const response = await fetch('/api/campaign-content', {cache:'no-store', credentials:'same-origin'});
      if (response.ok) {
        const result = await response.json();
        if (result.content && typeof result.content === 'object') {
          const content = result.content;
          window.CAMPAIGN = {
            ...defaults, ...content,
            party:{...(defaults.party||{}), ...(content.party||{})},
            campaignInfo:{...(defaults.campaignInfo||{}), ...(content.campaignInfo||{})}
          };
        }
      }
    } catch (error) {
      console.warn('Не удалось загрузить сохранённые настройки кампании; используется campaign-config.js.', error);
    }
    if (!window.CAMPAIGN) window.CAMPAIGN = defaults;
    await loadScript('app.js?v=20261013-content-builder');
    await loadScript('campaign-admin.js?v=20261013-content-builder');
  })().catch(error => {
    console.error(error);
    const main = document.querySelector('#main');
    if (main) main.insertAdjacentHTML('afterbegin','<p role="alert" class="load-error">Архив пока не удалось открыть. Обновите страницу или попробуйте позже.</p>');
  });
})();
