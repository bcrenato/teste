document.addEventListener('DOMContentLoaded', () => {
  const telefoneInput = document.getElementById('telefone');

  IMask(telefoneInput, {
    mask: [
      {
        mask: '(00) 0000-0000', // formato para telefone fixo
      },
      {
        mask: '(00) 00000-0000', // formato para celular
      }
    ],
    dispatch: function (appended, dynamicMasked) {
      const number = (dynamicMasked.value + appended).replace(/\D/g, '');
      return number.length > 10
        ? dynamicMasked.compiledMasks[1]
        : dynamicMasked.compiledMasks[0];
    }
  });
});
