// Дополнения «живого города»: голуби и общение прохожих между собой (разговоры, ссоры, проверка документов).
import * as THREE from 'three';

const R = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export function createExtras(env) {
  const { scene, P, people, say, isNight, inKiosk, audio, blocked, canSee } = env;

  // =====================================================================
  //  ГОЛУБИ: стайки сизарей у остановки, на площадке и во дворах.
  //  Клюют крошки, семенят по снегу, взлетают от шагов, машин и выстрелов, садятся на новом месте.
  // =====================================================================
  const bodyM = new THREE.MeshLambertMaterial({ color: 0x6f7682 });
  const headM = new THREE.MeshLambertMaterial({ color: 0x4c5560 });
  const neckM = new THREE.MeshLambertMaterial({ color: 0x4f6a5c }); // зеленоватый отлив шеи
  const wingM = new THREE.MeshLambertMaterial({ color: 0x8a909a, side: THREE.DoubleSide });
  const darkM = new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
  const beakM = new THREE.MeshLambertMaterial({ color: 0xc8b89a });
  const gBody = new THREE.SphereGeometry(.07, 10, 8); gBody.scale(.8, .75, 1.35);
  const gHead = new THREE.SphereGeometry(.034, 8, 6);
  const gNeck = new THREE.CylinderGeometry(.026, .036, .06, 7);
  const gBeak = new THREE.ConeGeometry(.009, .03, 5); gBeak.rotateX(Math.PI / 2);
  const gTail = new THREE.BoxGeometry(.07, .008, .09);
  const gWing = new THREE.PlaneGeometry(.19, .1); gWing.translate(.095, 0, 0); gWing.rotateX(-Math.PI / 2);
  const gFold = new THREE.SphereGeometry(.05, 8, 6); gFold.scale(.35, .6, 1.5);

  function makeBird() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(gBody, bodyM); body.position.y = .09; body.castShadow = false; g.add(body);
    const neck = new THREE.Group(); neck.position.set(0, .125, .075); g.add(neck);
    const nk = new THREE.Mesh(gNeck, neckM); nk.position.y = .02; nk.rotation.x = .35; neck.add(nk);
    const head = new THREE.Mesh(gHead, headM); head.position.set(0, .062, .022); neck.add(head);
    const beak = new THREE.Mesh(gBeak, beakM); beak.position.set(0, .058, .062); neck.add(beak);
    const tail = new THREE.Mesh(gTail, darkM); tail.position.set(0, .085, -.12); tail.rotation.x = -.25; g.add(tail);
    const fl = new THREE.Mesh(gFold, wingM), fr = new THREE.Mesh(gFold, wingM); fl.position.set(-.045, .1, -.01); fr.position.set(.045, .1, -.01); g.add(fl, fr);
    const wl = new THREE.Mesh(gWing, wingM), wr = new THREE.Mesh(gWing, wingM); wl.position.set(-.03, .12, 0); wl.scale.x = -1; wr.position.set(.03, .12, 0); wl.visible = wr.visible = false; g.add(wl, wr);
    g.userData.dyn = true; g.traverse(o => { o.userData.dyn = true; o.userData.keep = true; });
    scene.add(g);
    return { g, neck, wl, wr, fl, fr, st: 'ground', t: R(0, 3), tx: 0, tz: 0, vx: 0, vy: 0, vz: 0, peck: 0, ph: R(0, 6) };
  }
  // места кормёжки (открытые площадки без коллизий): остановка у ларька, детская площадка, двор дома № 14, у хлебозавода, у гаражей, средняя улица
  const SPOTS = [[5.5, 5.0], [-4.5, 4.4], [-21, -3.5], [12, -2.2], [-36, 3.6], [30, 3.5], [44, 62.5], [-94, 44.5], [14, -15], [-12, 17.2], [-60, 4.2], [20, 56.5]];
  const flocks = [];
  for (let f = 0; f < 3; f++) {
    const s = SPOTS[f]; const fl = { cx: s[0], cz: s[1], spot: f, birds: [], calm: 0, air: false };
    const n = 4 + (f === 0 ? 2 : 0);
    for (let i = 0; i < n; i++) { const b = makeBird(); b.g.position.set(s[0] + R(-1.2, 1.2), 0, s[1] + R(-.9, .9)); b.g.rotation.y = R(0, 6.28); b.tx = b.g.position.x; b.tz = b.g.position.z; fl.birds.push(b); }
    flocks.push(fl);
  }
  function takeOff(fl, fromX, fromZ) {
    if (fl.air) return;
    fl.air = true; fl.calm = R(5, 9);
    // новое место — не ближе 14 м к игроку и не занятое другой стаей
    const taken = new Set(flocks.map(f => f.spot));
    const cand = SPOTS.map((s, i) => i).filter(i => !taken.has(i) && Math.hypot(SPOTS[i][0] - P.x, SPOTS[i][1] - P.z) > 14 && Math.hypot(SPOTS[i][0] - fl.cx, SPOTS[i][1] - fl.cz) < 90);
    const ni = cand.length ? pick(cand) : fl.spot; fl.spot = ni; fl.cx = SPOTS[ni][0]; fl.cz = SPOTS[ni][1];
    for (const b of fl.birds) {
      b.st = 'fly'; b.t = R(0, .35); b.tx = fl.cx + R(-1.3, 1.3); b.tz = fl.cz + R(-1, 1);
      const ax = b.g.position.x - fromX, az = b.g.position.z - fromZ, al = Math.hypot(ax, az) || 1;
      b.vx = ax / al * R(2.5, 4); b.vz = az / al * R(2.5, 4); b.vy = R(3.2, 4.6); b.cruise = R(5.5, 9);
      b.wl.visible = b.wr.visible = true; b.fl.visible = b.fr.visible = false;
    }
    const d = Math.hypot(fl.birds[0].g.position.x - P.x, fl.birds[0].g.position.z - P.z);
    if (audio && audio.click && d < 22) { const v = Math.max(.05, .3 - d * .012); for (let i = 0; i < 5; i++) audio.click(170 + i * 22, v, i * .055, .035); }
  }
  function scare(x, z, r) { for (const fl of flocks) if (!fl.air && Math.hypot(fl.cx - x, fl.cz - z) < r + 2) takeOff(fl, x, z); }
  function pigeonsTick(dt, cars) {
    const night = isNight();
    const inIndoors = (P.x > 34.6 && P.x < 49.8 && P.z > 74.05 && P.z < 84.0) || (P.x < -112 && P.z > 58);
    if (inIndoors) {
      for (const fl of flocks) for (const b of fl.birds) b.g.visible = false;
      return;
    }
    const pSp = Math.hypot(P.vx || 0, P.vz || 0);
    for (const fl of flocks) {
      const dP = Math.hypot(fl.cx - P.x, fl.cz - P.z);
      if (dP > 38 && !fl.air) {
        for (const b of fl.birds) b.g.visible = false;
        continue;
      }
      if (!fl.air) {
        // кто спугнул: игрок (на бегу — издалека), прохожий вплотную, машина
        let sx = null, sz = null;
        if (dP < 2.3 + pSp * .75 + (P.crouch ? -.9 : 0)) { sx = P.x; sz = P.z; }
        else if (dP < 70) {
          for (const q of people) { if (q.dead || q.inBus) continue; const qp = q.h.obj.position; if (Math.abs(qp.x - fl.cx) < 1.5 && Math.abs(qp.z - fl.cz) < 1.5) { sx = qp.x; sz = qp.z; break; } }
          if (sx === null && cars) for (const c of cars) { if (Math.abs(c.x - fl.cx) < 3.4 && Math.abs(c.z - fl.cz) < 3.4 && (c.v || 0) > 1) { sx = c.x; sz = c.z; break; } }
        }
        if (sx !== null) takeOff(fl, sx, sz);
      }
      let landed = 0;
      for (const b of fl.birds) {
        const p = b.g.position; b.g.visible = !night || b.st === 'fly';
        if (b.st === 'ground') {
          landed++; b.t -= dt;
          const dx = b.tx - p.x, dz = b.tz - p.z, dl = Math.hypot(dx, dz);
          if (dl > .06) { // семенит к точке, кивая головой
            const sp = .55; p.x += dx / dl * sp * dt; p.z += dz / dl * sp * dt;
            let da = Math.atan2(dx, dz) - b.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); b.g.rotation.y += da * Math.min(1, dt * 8);
            b.ph += dt * 16; b.neck.position.z = .075 + Math.sin(b.ph) * .014; b.neck.rotation.x = 0; p.y = Math.abs(Math.sin(b.ph * .5)) * .008;
          } else {
            p.y = 0;
            if (b.peck > 0) { b.peck -= dt; b.neck.rotation.x = .95 * Math.abs(Math.sin(b.peck * 11)); }
            else { b.neck.rotation.x += (0 - b.neck.rotation.x) * Math.min(1, dt * 10); if (Math.random() < dt * .9) b.peck = R(.5, 1.3); }
            if (b.t <= 0) { b.t = R(1.2, 4.5); const nx = fl.cx + R(-1.5, 1.5), nz = fl.cz + R(-1.1, 1.1); if (!blocked || !blocked(nx, nz)) { b.tx = nx; b.tz = nz; } }
          }
        } else { // полёт: взлёт свечой, затем дуга к новому месту и посадка
          if (b.t > 0) { b.t -= dt; landed += 0; continue; }
          const dx = b.tx - p.x, dz = b.tz - p.z, dl = Math.hypot(dx, dz);
          const wantY = dl > 7 ? b.cruise : Math.max(0, dl * .75 - .2);
          const sp = dl > 7 ? 9.5 : 4 + dl * .7;
          const ax = (dl > .01 ? dx / dl * sp : 0) - b.vx, az = (dl > .01 ? dz / dl * sp : 0) - b.vz;
          b.vx += ax * Math.min(1, dt * 1.7); b.vz += az * Math.min(1, dt * 1.7);
          b.vy += ((wantY - p.y) * 2.2 - b.vy) * Math.min(1, dt * 2.5);
          p.x += b.vx * dt; p.y = Math.max(0, p.y + b.vy * dt); p.z += b.vz * dt;
          const hd = Math.atan2(b.vx, b.vz); let da = hd - b.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); b.g.rotation.y += da * Math.min(1, dt * 6);
          b.ph += dt * (dl > 7 ? 22 : 30); const fa = Math.sin(b.ph) * 1.0; b.wl.rotation.z = -fa; b.wr.rotation.z = fa;
          b.neck.rotation.x = .25; b.neck.position.z = .075;
          if (dl < .35 && p.y < .12) { b.st = 'ground'; p.y = 0; b.t = R(.5, 2); b.wl.visible = b.wr.visible = false; b.fl.visible = b.fr.visible = true; b.peck = 0; }
        }
      }
      if (fl.air && landed === fl.birds.length) fl.air = false;
    }
  }

  // =====================================================================
  //  ОБЩЕНИЕ ПРОХОЖИХ МЕЖДУ СОБОЙ
  //  Двое оказались рядом — останавливаются, поворачиваются друг к другу и говорят. Тема и исход зависят от того, кто встретился.
  // =====================================================================
  const NAME = { babka: 'Бабушка', dedushka: 'Дед', worker: 'Рабочий', youth: 'Парень', neighbor: 'Сосед', gopnik: 'Пацан', police: 'Сержант', chelnok: 'Челнок', newrus: 'Коммерсант', vendor: 'Торговка' };
  const isFem = p => !!(p.h && p.h.L && p.h.L.male === false);
  const nm = p => p.kind === 'neighbor' && isFem(p) ? 'Соседка' : p.kind === 'youth' && isFem(p) ? 'Девушка' : p.kind === 'worker' && isFem(p) ? 'Женщина' : (NAME[p.kind] || 'Прохожий');
  const TALK = {
    'babka+babka': [
      ['Слыхала, Петровна? Хлеб с утра опять подорожал!', 'Ой, не говори, милая! При Брежневе буханка шестнадцать копеек стоила, а нынче страшно в булочную зайти.', 'А пенсию в сберкассе третью неделю задерживают…', 'Только ларьков кругом понаставили, спекулянты окаянные!'],
      ['Ты ваучер-то свой получила в собесе?', 'Получила, да толку-то с этой бумажки? Сын говорит — в «ПМП» нести надо.', 'Смотри, обманут ведь! У Зинаиды племянник ларёк держит, говорит — лучше сахар и тушёнку брать.', 'И то верно, крупа да спички в доме надёжнее!'],
      ['Сегодня в шестом часу утра к хлебозаводу ходила.', 'Ну и как, взяла свежего «Дарницкого»?', 'Взяла две буханки тёплых прямо с лотка, пока очередь не набежала!', 'Слава богу, хоть хлебозавод наш ещё печёт.']
    ],
    'babka+dedushka': [
      ['Егор, ты ваучер приватизационный куда положил?', 'В сервант за хрусталь спрятал. Пусть лежит, каши не просит.', 'Соседка говорит — за него две бутылки водки дают у вокзала!', 'Вот ещё! Я сорок лет на заводе отпахал не за две поллитровки.'],
      ['В гастрономе опять пустые полки, одна морская капуста стоит.', 'Зато в коммерческом ларьке всё есть — от тушёнки до импортного шоколада.', 'Цены-то там видела какие? Втридорога дерут!', 'А куда деваться, старая… Время нынче волчье.']
    ],
    'babka+worker': [
      ['Сынок, а завод-то ваш работает или совсем встал?', 'Дышим через раз, мать. Третий месяц зарплату консервами да бартером выдают.', 'Господи, как же семьи-то кормить…', 'Вот крутимся как можем: кто на рынок идёт, кто к ларькам подрабатывать.'],
      ['Что ж вы, мужики, директору своему слова не скажете?', 'А кому говорить, бабуль? Директор в Москве в министерстве сидит, а цеха кооператорам сдали.', 'Бессовестные! Такую махину развалили…', 'Ничего, прорвёмся, руки-то рабочие помнят дело.']
    ],
    'babka+youth': [
      ['Ты бы шапку надел, внучек! На улице мороз, голову застудишь!', 'Да нормально мне, бабуль, я до остановки только.', 'Нормально ему! Ходите нараспашку, а потом менингит лечите!', 'Ладно-ладно, сейчас капюшон накину.'],
      ['Всё жвачку свою иностранную жуёте да кассеты крутите…', 'Бабуль, это «Кино» и «Сектор Газа», весь двор слушает!', 'Тьфу, срамота одна! Лучше бы матери по хозяйству помог.', 'Помогу, я как раз за хлебом в ларёк иду.']
    ],
    'babka+neighbor': [
      ['В третьем подъезде вчера опять свет на два часа вырубали.', 'И батареи еле тёплые! На теплотрассе за Муркой снова пар валит столбом.', 'Зинаида в ЖЭК ходила ругаться — говорят, задвижку чинят.', 'У них каждую зиму одно и то же, только квитанции носить успевают!'],
      ['Почём нынче в ларьке у остановки тушёнка, не глядела?', 'Глядела утром — кусается цена, но говяжья, настоящая, с нашего мясокомбината.', 'Толин племянник там теперь торгует, вежливый вроде парень.', 'Лишь бы «заводские» бандиты парня со свету не сжили, как дядю его…']
    ],
    'dedushka+dedushka': [
      ['Мы ведь этот город после войны своими руками поднимали, Петрович…', 'Не трави душу, Егор. Смотреть больно, как завод по кускам растаскивают.', 'Ладно хоть курево в ларьке есть, пойдём по пачке «Космонавта» возьмём.', 'Пойдём, пока пенсию совсем инфляция не съела.'],
      ['В субботу на Мурку пойдём со льда окуня дёргать?', 'Обязательно пойдём! Мотыля припас, бур наточил.', 'Главное — у промзоны не бурить, там со спиртзавода сброс тёплый.', 'Знаю, у старого моста сядем, там клёв верный.']
    ],
    'dedushka+worker': [
      ['Здорово, бугор! Как там родной инструментальный цех?', 'Здорово, отец. Половина станков под пломбой, снабженцы металл в Прибалтику гонят.', 'Эх, при Союзе за такой саботаж в два счёта бы к стенке поставили!', 'А теперь это у них «свободный рынок» называется, отец.']
    ],
    'dedushka+youth': [
      ['Слышь, парень, который час? Мои «Командирские» отставать стали.', 'Без четверти, дед. На ларьке вон часы точные висят.', 'Спасибо, внук. Смотри у меня — к шпане заводской не вяжись.', 'Я сам по себе, дед, мне чужого не надо.']
    ],
    'worker+worker': [
      ['Слышал новость? Получать за октябрь будем тушёнкой и спиртом!', 'Да ты что?! А за квартиру чем платить — банками жестяными?', 'Гена-кладовщик сказал, коммерсанты с ларьков оптом за наличку забирают.', 'Тогда после смены сразу к ларьку на Советской пойдём, сдадим!'],
      ['У тебя закурить не найдётся? С утра у станка стою, уши пухнут.', 'Держи, последняя осталась. Сейчас к ларьку подойдём, пачку возьмём.', 'Подорожали опять сигареты-то, небось?', 'Каждый день ценники переписывают, за курсом доллара не угонишься!']
    ],
    'worker+youth': [
      ['Здорово, малой! На завод учеником токаря не надумал идти?', 'Не, дядь Миш, вы же сами третий месяц без получки сидите. Я лучше у челноков грузчиком.', 'Тоже верно… На рынке хоть живую копейку к вечеру платят.', 'Ага, за день на кроссовки и кассету заработать можно!']
    ],
    'worker+neighbor': [
      ['Седьмой автобус давно проходил? Пятнадцать минут на морозе топчусь.', 'Дядя Коля минут десять назад к промзоне проехал, скоро обратно пойдёт.', 'Хорошо хоть его старый ЛиАЗ ещё на ходу, а то пешком через мост далеко.', 'Внутри у него печка жарит — сейчас сядем, отогреемся.']
    ],
    'youth+youth': [
      ['Ты кассету новую на двухкассетнике переписал?', 'Ага! На стороне «А» — «Кино», а на «Б» — свежий «Сектор Газа»!', 'Красава! Дашь на вечер послушать? Я батарейки «Квант» в ларьке куплю.', 'Только плёнку карандашом аккуратно перематывай, чтобы не зажевало!'],
      ['Сегодня вечером в ДК на дискотеку пойдёшь?', 'Если стольник на вход найду. Там пацаны с Заводского района собираются.', 'Смотри осторожнее, вчера у остановки опять драка была.', 'Прорвёмся, главное — поодиночке ночью за гаражами не ходить.']
    ],
    'youth+neighbor': [
      ['Здравствуйте! Вы случайно не видели, ларёк сегодня дотемна работает?', 'Здравствуй. Открыт вроде, новый хозяин там с самого утра крутится.', 'Отлично, мне жвачку «Турбо» и лимонад «Буратино» купить надо.', 'Беги, пока очередь с автобуса не высыпала.']
    ],
    'neighbor+neighbor': [
      ['Слышали? На привокзальном рынке вчера у женщины кошелёк прямо из сумки вытащили!', 'Средь бела дня! Шпаны развелось — вечером страшно из подъезда выйти.', 'А участковый наш только у ларька документы проверяет.', 'И не говорите, каждый сам за себя теперь выживает.'],
      ['Курс доллара видели сегодня у обменника? Опять вверх пополз!', 'Кто поумнее — сразу всю зарплату в зелёные бумажки переводит.', 'Где б её ещё взять, эту зарплату, чтобы переводить…', 'Пойдёмте хоть хлеба купим, пока по старой цене лежит.']
    ],
    'chelnok+neighbor': [
      ['Турецкие свитера «Boys», джинсы «Мальвина», кожаные куртки! Подходите, по-соседски уступлю!', 'Хороша куртка, да ведь две моих зарплаты стоит…', 'Возьмите в рассрочку до получки, я же вас по двору знаю!', 'Спасибо, мил человек, подумаю до завтра.']
    ],
    'chelnok+youth': [
      ['Парень, глянь какие кроссовки и джинсы «Мальвина» из Польши привёз!', 'Ого, фирмá! И почём такие джинсы?', 'Для своих — почти даром, за полцены от толкучки.', 'Сейчас у коммерсанта в ларьке подработаю и забегу!']
    ],
    'newrus+worker': [
      ['Слышь, командир, где тут у вас нормальный сервис или шиномонтаж?', 'За гаражами во втором ряду Марат стоит, у него там все блатные чинятся.', 'Во, от души, братан! А в ларьке этом импорт водится?', 'Спроси у продавца из-под полы — у него и «Рояль», и видак имеется.']
    ],
  };
  const GOP_ASK = [
    ['Слышь, земеля, тормозни-ка! Закурить для пацанов не найдётся?', 'Мужики, не курю, честно.', 'А если по карманам пошарим и найдём? Ты чё такой дерзкий?!'],
    ['Э, уважаемый, мелочью на пиво пацанам не выручишь?', 'У самого в кармане пусто, с завода иду.', 'Ты нам баки не забивай! А ну попрыгай на месте, проверим!'],
    ['Стоять! Ты с какого района будешь, фраер?', 'С Советской я, вон в четырнадцатом доме живу.', 'С Советской он… А старших на районе знаешь?! Выворачивай карманы!']
  ];
  const POL_CHECK = [
    ['Сержант милиции Кузьмин! Гражданин, предъявите документы и паспорт.', 'Товарищ сержант, я местный, из дома напротив за хлебом вышел…', 'Ладно, на первый раз верю. Но чтобы без прописки ночью не шатались!'],
    ['Милиция! Что в бауле несём, гражданин? Запрещённое имеется?', 'Никак нет, начальник! Крупа, хлеб да банка кильки из ларька.', 'Понятно. Проходите и соблюдайте общественный порядок на улице!'],
    ['Так, гражданин, спиртное в общественном месте распиваем?!', 'Что вы, товарищ сержант, это лимонад «Буратино», можете понюхать!', 'Ладно, свободны. Если увижу драку у ларька — сразу в РОВД поедете!']
  ];
  const SCOLD = [
    ['Ишь, сбились в стаю, тунеядцы окаянные! Шли бы на завод работать!', 'Бабуль, шла бы ты своей дорогой за хлебом, пока мы добрые.', 'Я вот сейчас участковому Кузьмину свистну — он вам живо кудри поправит!'],
    ['Совести у вас нет, ироды! У рабочих людей последнюю копейку отбираете!', 'Не шуми, мать, мы культурно общаемся, никого не трогаем.']
  ];

  const busy = p => !p || p.dead || p.role !== 'ped' || p.inBus || p.brawling || p.flee || p.leaving || p.talking || p.state === 'talking' || p.waitingBus || p.carried || p.hidden || p.soc || p.hitStun > 0 || p.approachingPlayer || p.investigatePlayer || p.benchSpot || !(p.state === 'walk' || p.state === 'pause') || (p.socCd || 0) > 0;
  const scenes = [];
  let scanT = 2;
  function begin(a, b) {
    const ka = a.kind, kb = b.kind; let lines = null, kind = 'talk';
    const has = k => ka === k || kb === k, who = k => ka === k ? a : b, other = k => ka === k ? b : a;
    if (has('police') && (has('gopnik') || has('youth') || has('worker') || has('chelnok')) && ka !== kb) { const pol = who('police'), q = other('police'); const s = pick(POL_CHECK); lines = [[pol, s[0]], [q, s[1]], [pol, s[2]]]; kind = 'check'; }
    else if (has('gopnik') && has('babka')) { const g = who('gopnik'), bb = who('babka'); const s = pick(SCOLD); lines = [[bb, s[0]], [g, s[1]]]; kind = 'scold'; }
    else if (has('gopnik') && ka !== kb && !has('police')) { const g = who('gopnik'), v = other('gopnik'); const s = pick(GOP_ASK); lines = [[g, s[0]], [v, s[1]], [g, s[2]]]; kind = 'conflict'; }
    else if (ka === 'gopnik' && kb === 'gopnik') { lines = [[a, pick(['Чё, пацаны, по пиву?', 'Видал того коммерсанта в ларьке?', 'Семки есть?'])], [b, pick(['Денег нет. Пошли стрельнём у кого.', 'Видал. Надо бы зайти, познакомиться.', 'На, отсыпь.'])]]; }
    else {
      const key = [ka, kb].sort().join('+');
      const fallbackSet = [
        ['Холодно сегодня на улице, ветер прямо с реки тянет.', 'И не говори! Зато в ларьке у остановки свежий товар завезли.', 'Надо будет заглянуть, пока всё не разобрали.'],
        ['Не подскажешь, автобус седьмой скоро подойдёт?', 'Да вот с минуты на минуту должен из-за поворота показаться.', 'Ну слава богу, а то ноги уже замёрзли стоять.']
      ];
      const set = TALK[key] || fallbackSet;
      const s = pick(set);
      const first = [ka, kb].sort()[0] === ka ? a : b, second = first === a ? b : a;
      lines = s.map((txt, idx) => [idx % 2 === 0 ? first : second, txt]);
    }
    // Сближаем собеседников на реалистичную дистанцию разговора (1.05..1.18 м друг от друга лицом к лицу)
    const ax = a.h.obj.position.x, az = a.h.obj.position.z;
    const bx = b.h.obj.position.x, bz = b.h.obj.position.z;
    const mx = (ax + bx) * 0.5, mz = (az + bz) * 0.5;
    const dx = bx - ax, dz = bz - az, dl = Math.hypot(dx, dz) || 1;
    const targetHalf = 0.56; // итого 1.12 м между центрами собеседников
    const nax = mx - (dx / dl) * targetHalf, naz = mz - (dz / dl) * targetHalf;
    const nbx = mx + (dx / dl) * targetHalf, nbz = mz + (dz / dl) * targetHalf;
    if (!blocked || (!blocked(nax, naz) && !blocked(nbx, nbz))) {
      a.h.obj.position.x = nax; a.h.obj.position.z = naz;
      b.h.obj.position.x = nbx; b.h.obj.position.z = nbz;
    }
    const sc = { a, b, lines, i: 0, t: .45, kind, done: false, mx, mz, ux: dx / dl, uz: dz / dl };
    for (const p of [a, b]) { const o = p === a ? b : a; p.soc = sc; p.path = []; p.then = null; p.state = 'pause'; p.timer = 35; p.anim = 'talk'; p.faceRot = Math.atan2(o.h.obj.position.x - p.h.obj.position.x, o.h.obj.position.z - p.h.obj.position.z); if (p.h.setExpr) p.h.setExpr(kind === 'conflict' || kind === 'scold' ? 'angry' : 'talk'); }
    scenes.push(sc); return true;
  }
  function finish(sc, interrupted) {
    sc.done = true;
    for (const p of [sc.a, sc.b]) { if (p.soc !== sc) continue; p.soc = null; p.socCd = R(45, 100); p.faceRot = null; if (!p.dead && !p.brawling && !p.flee && p.state === 'pause') { p.timer = R(.3, 1.2); p.anim = 'idle'; if (p.h.setExpr) p.h.setExpr('neutral'); } }
    if (interrupted) return;
    if (sc.kind === 'conflict') {
      const g = sc.a.kind === 'gopnik' ? sc.a : sc.b, v = g === sc.a ? sc.b : sc.a; if (g.dead || v.dead) return;
      const tough = v.kind === 'worker' || (v.h.L && v.h.L.aggression > .55);
      const r = Math.random();
      if (tough && r < .45) { say(v, pick(['А ну пшёл отсюда, шпана!', 'Я тебе сейчас попрыгаю!']), 9); g.hitStun = .5; if (g.h.setExpr) g.h.setExpr('scared'); env.fleeNpc(g, 2.6); }
      else if (r < .55) { say(v, pick(['На, держи, только отстань.', 'Вот, всё что есть…']), 9); if (v.h.setExpr) v.h.setExpr('scared'); env.fleeNpc(v, 2.2); }
      else { v.hitStun = .55; if (audio && audio.thud && Math.hypot(v.h.obj.position.x - P.x, v.h.obj.position.z - P.z) < 16) audio.thud(.45); say(v, pick(['Ай! Ты чего толкаешься?!', 'Милиция!']), 9); if (v.h.setExpr) v.h.setExpr('scared'); env.fleeNpc(v, 3.3); if (env.onStreetCrime) env.onStreetCrime(g, v); }
    } else if (sc.kind === 'scold') { const g = sc.a.kind === 'gopnik' ? sc.a : sc.b; if (!g.dead) env.fleeNpc(g, 1.8, true); }
  }
  function socialTick(dt) {
    for (const p of people) if (p.socCd > 0) p.socCd -= dt;
    for (let i = scenes.length - 1; i >= 0; i--) {
      const sc = scenes[i];
      const broken = [sc.a, sc.b].some(p => p.dead || p.brawling || p.flee || p.soc !== sc || p.state !== 'pause' || !people.includes(p));
      if (broken) { finish(sc, true); scenes.splice(i, 1); continue; }
      sc.a.timer = sc.b.timer = 35; // держим обоих на месте и плавно подтягиваем на 1.12 м друг к другу
      const curDx = sc.b.h.obj.position.x - sc.a.h.obj.position.x;
      const curDz = sc.b.h.obj.position.z - sc.a.h.obj.position.z;
      const curD = Math.hypot(curDx, curDz) || 1;
      if (curD > 1.22 || curD < 0.95) {
        const stepK = (curD - 1.12) * Math.min(1, dt * 4.5) * 0.5;
        sc.a.h.obj.position.x += (curDx / curD) * stepK;
        sc.a.h.obj.position.z += (curDz / curD) * stepK;
        sc.b.h.obj.position.x -= (curDx / curD) * stepK;
        sc.b.h.obj.position.z -= (curDz / curD) * stepK;
      }
      sc.a.faceRot = Math.atan2(sc.b.h.obj.position.x - sc.a.h.obj.position.x, sc.b.h.obj.position.z - sc.a.h.obj.position.z);
      sc.b.faceRot = Math.atan2(sc.a.h.obj.position.x - sc.b.h.obj.position.x, sc.a.h.obj.position.z - sc.b.h.obj.position.z);
      sc.t -= dt;
      if (sc.t <= 0) {
        if (sc.i < sc.lines.length) { const [p, text] = sc.lines[sc.i++]; say(p, text, 9, nm(p)); for (const q of [sc.a, sc.b]) q.anim = q === p ? (sc.kind === 'conflict' && q.kind === 'gopnik' && sc.i === sc.lines.length ? 'threaten' : 'talk') : 'idle'; sc.t = 2.1 + text.length * .035; }
        else { finish(sc, false); scenes.splice(i, 1); }
      }
    }
    scanT -= dt; if (scanT > 0 || scenes.length >= 2) return; scanT = 1.3;
    const near = people.filter(p => !busy(p) && Math.hypot(p.h.obj.position.x - P.x, p.h.obj.position.z - P.z) < 34 && !inKiosk(p.h.obj.position.x, p.h.obj.position.z));
    for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
      const a = near[i], b = near[j]; if (a.group && a.group === b.group && a.role === 'gop') continue;
      const d = Math.hypot(a.h.obj.position.x - b.h.obj.position.x, a.h.obj.position.z - b.h.obj.position.z);
      if (d < 2.4 && d > .7 && Math.random() < .55) { if (begin(a, b)) return; }
    }
  }
  return { pigeonsTick, scare, socialTick, nm };
}
