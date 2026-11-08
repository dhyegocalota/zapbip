import { expect, type Locator, type Page } from '@playwright/test';

export async function expectNoHorizontalScroll(input: { page: Page }): Promise<void> {
  const viewport = input.page.viewportSize();
  if (viewport === null) throw new Error('the page has no viewport');
  const scrollWidth = await input.page.locator('html').evaluate((element) => element.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
}

type Box = { x: number; y: number; width: number; height: number };

function intersects(input: { first: Box; second: Box }): boolean {
  const { first, second } = input;
  const isSeparatedHorizontally = first.x + first.width <= second.x || second.x + second.width <= first.x;
  const isSeparatedVertically = first.y + first.height <= second.y || second.y + second.height <= first.y;
  return !isSeparatedHorizontally && !isSeparatedVertically;
}

async function boxesOf(input: { locator: Locator }): Promise<Box[]> {
  const boxes = await Promise.all((await input.locator.all()).map((element) => element.boundingBox()));
  return boxes.map((box) => {
    if (box === null) throw new Error('an element of the chart has no box');
    return box;
  });
}

export async function expectChartLabelsClear(input: { chart: Locator; bars: Locator; labels: Locator }): Promise<void> {
  const chartBox = (await boxesOf({ locator: input.chart }))[0];
  if (chartBox === undefined) throw new Error('the chart has no box');
  const barBoxes = await boxesOf({ locator: input.bars });
  const labelBoxes = await boxesOf({ locator: input.labels });
  expect(labelBoxes.length).toBeGreaterThan(1);
  labelBoxes.forEach((label, index) => {
    expect(label.x).toBeGreaterThanOrEqual(chartBox.x);
    expect(label.y).toBeGreaterThanOrEqual(chartBox.y);
    expect(label.x + label.width).toBeLessThanOrEqual(chartBox.x + chartBox.width);
    barBoxes.forEach((bar) => expect(intersects({ first: label, second: bar })).toBe(false));
    labelBoxes.slice(index + 1).forEach((other) => expect(intersects({ first: label, second: other })).toBe(false));
  });
}

export async function expectSiblingsApart(input: { container: Locator }): Promise<void> {
  const children = await input.container.locator(':scope > *').all();
  const boxes = (await Promise.all(children.map((child) => child.boundingBox()))).filter((box): box is Box => box !== null);
  boxes.forEach((first, index) => boxes.slice(index + 1).forEach((second) => expect(intersects({ first, second })).toBe(false)));
}
