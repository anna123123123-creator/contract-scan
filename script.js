(function () {
  'use strict';

  var EXAMPLE = '甲方有权根据实际情况单方面调整服务内容，无需提前通知乙方。\n' +
    '本合同自签订之日起自动续约，如需终止，须提前90天以书面形式通知对方，否则视为自动延续一年。\n' +
    '乙方逾期付款的，每逾期一日按照合同总金额的5%支付违约金，且甲方保留追究其连带责任的权利。\n' +
    '因不可抗力导致本合同无法履行的，甲方不承担任何责任，具体范围由甲方最终解释。\n' +
    '本合同履行期间及终止后，乙方应对甲方提供的一切资料承担保密义务。\n' +
    '因本合同产生的争议，由甲方所在地人民法院管辖。';

  var RISK_PATTERNS = [
    { cat: '单方权利', re: /单方面?(?:调整|变更|解除|决定|终止)/g, note: '赋予一方单方面变更/解除权，注意是否对等，另一方是否有对应救济手段。' },
    { cat: '通知义务', re: /无需(?:提前)?通知|不另行通知/g, note: '免除通知义务的条款，可能导致另一方措手不及，建议约定合理通知期限。' },
    { cat: '自动续约', re: /自动续约|自动续期|视为自动延续/g, note: '自动续约条款需明确提前终止的通知期限，避免被动续约。' },
    { cat: '违约责任', re: /违约金|逾期.{0,6}(?:支付|赔偿)/g, note: '核实违约金比例是否畸高，过高的违约金在争议时可能被要求调整。' },
    { cat: '连带责任', re: /连带责任/g, note: '连带责任范围通常较重，需明确责任边界和触发条件。' },
    { cat: '免责条款', re: /不承担(?:任何)?责任|免除.{0,4}责任/g, note: '免责范围需审查是否合理排除了本不应免除的法定责任。' },
    { cat: '不可抗力', re: /不可抗力/g, note: '不可抗力的具体范围、通知期限和证明方式建议在合同中写明确。' },
    { cat: '最终解释权', re: /最终解释权?/g, note: '"最终解释权"归属一方的表述在很多场景下效力存疑，建议改为双方协商确定。' },
    { cat: '保密条款', re: /保密义务|保密期限/g, note: '确认保密义务的具体期限、范围和违反后的责任是否明确。' },
    { cat: '管辖约定', re: /(?:人民法院管辖|提交.{0,6}仲裁)/g, note: '约定管辖法院或仲裁机构时，评估该地点对己方是否便利。' },
    { cat: '定金条款', re: /定金(?!.*订金)/g, note: '"定金"与"订金"法律效力不同，定金通常适用"定金罚则"，需确认用词是否准确。' },
    { cat: '排他条款', re: /排他性|独家(?:授权|合作|代理)/g, note: '排他性/独家条款需评估限制范围、期限是否合理。' },
    { cat: '知识产权', re: /知识产权归.{0,4}所有/g, note: '知识产权归属条款需确认是否涵盖履行过程中产生的新成果。' },
  ];

  var contractInput = document.getElementById('contractInput');
  var highlightView = document.getElementById('highlightView');
  var findingsList = document.getElementById('findingsList');
  var findingCount = document.getElementById('findingCount');

  function escapeHTML(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function findAllMatches(text) {
    var matches = [];
    RISK_PATTERNS.forEach(function (p) {
      var re = new RegExp(p.re.source, p.re.flags.indexOf('g') === -1 ? p.re.flags + 'g' : p.re.flags);
      var m;
      while ((m = re.exec(text)) !== null) {
        matches.push({ index: m.index, length: m[0].length, text: m[0], cat: p.cat, note: p.note });
        if (m[0] === '') re.lastIndex++;
      }
    });
    matches.sort(function (a, b) { return a.index - b.index; });
    var deduped = [];
    var lastEnd = -1;
    matches.forEach(function (m) {
      if (m.index >= lastEnd) {
        deduped.push(m);
        lastEnd = m.index + m.length;
      }
    });
    return deduped;
  }

  function sentenceContext(text, start, end) {
    var left = text.lastIndexOf('\n', start);
    var leftPunct = Math.max(text.lastIndexOf('。', start), text.lastIndexOf('；', start), text.lastIndexOf('\n', start));
    var from = Math.max(left, leftPunct, 0);
    if (from > 0) from += 1;
    var rightPunct = text.indexOf('。', end);
    var rightNl = text.indexOf('\n', end);
    var to = rightPunct === -1 ? (rightNl === -1 ? text.length : rightNl) : (rightNl === -1 ? rightPunct : Math.min(rightPunct, rightNl));
    if (to === -1) to = text.length;
    return { from: from, to: to + 1 <= text.length ? to + 1 : text.length };
  }

  function scan() {
    var text = contractInput.value;
    var matches = findAllMatches(text);

    var html = '';
    var lastIndex = 0;
    matches.forEach(function (m) {
      html += escapeHTML(text.slice(lastIndex, m.index));
      html += '<mark>' + escapeHTML(m.text) + '</mark>';
      lastIndex = m.index + m.length;
    });
    html += escapeHTML(text.slice(lastIndex));
    highlightView.innerHTML = html || '<span style="color:var(--muted)">还没有输入合同文本。</span>';

    findingCount.textContent = String(matches.length);
    if (!matches.length) {
      findingsList.innerHTML = '<div class="empty-hint">没有扫描到内置关键词库里的风险条款，不代表合同完全没有风险，仅供参考。</div>';
      return;
    }

    findingsList.innerHTML = matches.map(function (m) {
      var ctx = sentenceContext(text, m.index, m.index + m.length);
      var before = escapeHTML(text.slice(ctx.from, m.index));
      var matchedText = escapeHTML(m.text);
      var after = escapeHTML(text.slice(m.index + m.length, ctx.to));
      return '<div class="finding-item">' +
        '<span class="cat">' + escapeHTML(m.cat) + '</span>' +
        '<div class="snippet">' + before + '<mark>' + matchedText + '</mark>' + after + '</div>' +
        '<div class="note">' + escapeHTML(m.note) + '</div>' +
        '</div>';
    }).join('');
  }

  document.getElementById('btnScan').addEventListener('click', scan);
  document.getElementById('btnExample').addEventListener('click', function () {
    contractInput.value = EXAMPLE;
    scan();
  });

  contractInput.value = EXAMPLE;
  scan();
})();
