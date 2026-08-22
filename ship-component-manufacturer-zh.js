(function (root) {
    'use strict';
    root.UssManufacturerZhMap = {
        'Associated Sciences & Development': '联科发',
        'Associated Science & Development': '联科发',
        'Associated Sciences and Development': '联科发',
        'Associated Science and Development': '联科发',
        ASD: '联科发',
        'J-Span': 'J-Span',
        'Aegis Dynamics': '圣盾动力',
        'Anvil Aerospace': '铁砧航天',
        'ARGO Astronautics': '南船座航天',
        'Argo Astronautics': '南船座航天',
        Banu: '巴努',
        'Consolidated Outland': '联合外延',
        'Crusader Industries': '十字军工业',
        'Drake Interplanetary': '德雷克行星际',
        Esperia: '埃斯佩里亚',
        'Gatac Manufacture': '盖塔克制造',
        'Kruger Intergalactic': '克鲁格星际',
        'Musashi Industrial': '武藏工业',
        'Origin Jumpworks': '起源跳跃',
        'Roberts Space Industries': '罗伯茨太空工业',
        'Tumbril Land Systems': 'Tumbril 陆地系统',
        Vanduul: '梵杜尔',
        'Vanduul Clans': '梵杜尔氏族',
        "Xi'an": '希安',
        'Ascension Astro': '上升航天',
        WillsOp: '威尔士Op',
        'RAMP Corporation': 'RAMP 公司',
        Behring: '贝林财团',
        'Behring Applied Technology': '贝林财团',
        'Wei-Tek': '纬泰',
        'Seal Corporation': '密封公司',
        'Lightning Power Ltd.': '闪电之力',
        'Chimera Communications': '奇美拉通讯',
        'Groupe Nouveau Paradigme': '新范式集团',
        GNP: '新范式集团',
        'Nav-E7 Gadgets': '领航E7工具',
        'Blue Triangle Inc.': '蓝三角公司',
        ArcCorp: '弧光集团',
        'Banu Souli': '巴努苏利',
        'Juno Starwerk': '朱诺星际工厂',
        'Sakura Sun': '樱日集团',
        Tarsus: '塔苏斯',
        'Tyler Design & Tech': '泰勒设计科技',
        'Wen-Cassel Propulsion': '温/卡塞尔推进',
        'Wen/Cassel Propulsion': '温/卡塞尔推进',
        Yorm: '约姆公司',
        'Ace Astrogation': '王牌航天',
        ACOM: 'ACOM',
        'Amon & Reese Co.': '亚蒙里斯公司',
        Basilisk: '毒蜥公司',
        'Gorgon Defender Industries': '戈贡防御工业',
        Unknown: '未知',
        'Gallenson Tactical Systems': '加仑森战术系统',
        'Greycat Industrial': '灰猫工业',
        'Klaus & Werner': '克劳斯&韦纳',
        MaxOx: '蛮牛',
        'Apocalypse Arms': '启示录军备',
        'Hurston Dynamics': '赫斯顿动力',
        'Shubin Intergalactic': '舒宾星际',
        'Thermyte Concern': '铝热公司',
        Mirai: '未来',
        'Nova Pyrotechnica': '新星火工',
        'KnightBridge Arms': '奈特布里奇军备',
        'PH Associated Science and Development': 'PH联合科学开发',
        Kroneg: '克朗格',
        'Joker Engineering': '小丑工程',
        Aopoa: '奥波亚',
        "Grey's Market": '格雷黑市',
        'Shubin Interstellar': '舒宾星际',
        'Musashi Industrial & Starflight Concern': '武藏工业与星航株式会社',
        'Musashi Industrial and Starflight Concern': '武藏工业与星航株式会社',
        'Flashfire Systems': '闪火系统',
        'FireStorm Kinetics': '火焰风暴动力学',
        'Firestorm Kinetics': '火焰风暴动力学',
        'Talon Weapons Systems': '鹰爪武器系统',
        'Talon Weapon Systems': '鹰爪武器系统',
        'Lightning Bolt Co.': '雷击公司',
        'Lightning Bolt Co': '雷击公司',
        'Verified Offworld Laser Technologies': 'VOLT',
        VOLT: 'VOLT',
        Gemini: '双子座',
        'Kastak Arms': '卡斯塔克武器',
        'Clark Defense Systems': '克拉克防御系统',
        'Quirinus Tech': '奎里努斯科技',
        'Roussimoff Rehabilitation Systems': '鲁西莫夫康复系统',
        UltiFlex: '优缇弗莱斯',
        Curelife: '治愈生命',
        'Kilgore and Poole': '基尔戈与普尔',
        Doomsday: '末日军备',
        Virgil: '维吉尔',
        Caldera: '卡尔德拉',
        "CC's Conversions": 'CC改装工坊',
        'Gyson Inc.': '盖森公司',
        Tehachapi: '特哈查比',
        'Syang Fabrication': '赛昂制造',
        'Hardin Tactical': '哈丁战术',
        'Hedeby Gunworks': '赫德比枪工',
        'Universal Body Armor': '通用身铠',
        'UEE Navy': 'UEE海军',
    };

    function normalizeMfgKey(s) {
        return String(s || '')
            .replace(/[＆﹠]/g, '&')
            .replace(/\s+and\s+/gi, ' & ')
            .replace(/\s*&\s*/g, ' & ')
            .replace(/^ph\s+/i, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    root.ussLookupManufacturerZh = function (raw) {
        var s = String(raw || '').trim();
        if (!s) return '';
        var map = root.UssManufacturerZhMap;
        if (map[s]) return map[s];
        var want = normalizeMfgKey(s);
        var keys = Object.keys(map);
        for (var i = 0; i < keys.length; i++) {
            if (normalizeMfgKey(keys[i]) === want) return map[keys[i]];
        }
        return '';
    };

    root.ussFormatManufacturerLabel = function (item) {
        var m = (item && (item.manufacturer_zh || item.manufacturer)) || '';
        if (!m || /^<=\s*PLACEHOLDER\s*=>$/i.test(m) || /placeholder/i.test(m)) return '—';
        m = String(m).trim();
        var paren = m.match(/^(.+?)\s*[（(][^)）]*[A-Za-z][^)）]*[)）]\s*$/);
        if (paren) m = paren[1].trim();
        if (item && item.manufacturer === 'Virgil') return '维吉尔';
        if (!/[\u4e00-\u9fff]/.test(m)) {
            var mapped =
                root.ussLookupManufacturerZh(m) || root.ussLookupManufacturerZh(item && item.manufacturer);
            if (mapped) return mapped;
        }
        return m || '—';
    };
})(typeof window !== 'undefined' ? window : this);
