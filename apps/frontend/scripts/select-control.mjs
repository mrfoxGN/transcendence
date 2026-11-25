// Exercise the custom option list while preserving value-based test readability.
export async function pickOption(page, locator, requested) {
  const native = await locator.evaluate((element) => element.tagName === 'SELECT');
  if (native) return locator.selectOption(requested);
  const label = await locator.evaluate((element, requested) => {
    const options = Array.from(
      element.closest('[data-devup-select]').querySelector('select').options,
    );
    const option =
      typeof requested === 'string'
        ? options.find((option) => option.value === requested)
        : requested.label
          ? options.find((option) => option.label === requested.label)
          : requested.value !== undefined
            ? options.find((option) => option.value === requested.value)
            : options[requested.index];
    if (!option) throw new Error('Requested select option was not found');
    return option.label;
  }, requested);
  await locator.click();
  await page
    .locator('.wu-select-popup:popover-open')
    .getByRole('option', { name: label, exact: true })
    .click();
}
