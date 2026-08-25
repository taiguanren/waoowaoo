import * as React from 'react'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ImageGenerationInlineCountButton from '@/components/image-generation/ImageGenerationInlineCountButton'

type TestElementProps = {
  children?: ReactNode
  onClick?: () => void
}

type TestSelectProps = {
  onChange: (event: { target: { value: string } }) => void
}

describe('ImageGenerationInlineCountButton', () => {
  it('keeps the select enabled when only the action is disabled', () => {
    Reflect.set(globalThis, 'React', React)

    const html = renderToStaticMarkup(
      createElement(ImageGenerationInlineCountButton, {
        prefix: createElement('span', null, '生成'),
        suffix: createElement('span', null, '张图片'),
        value: 3,
        options: [1, 2, 3],
        onValueChange: () => undefined,
        onClick: () => undefined,
        actionDisabled: true,
        selectDisabled: false,
        ariaLabel: '选择生成数量',
      }),
    )

    expect(html).not.toContain('role="button"')
    expect(html).toContain('<button type="button" disabled=""')
    expect(html).not.toContain('<select disabled=""')
    expect(html).toContain('rounded-full bg-white/12')
    expect(html).toContain('inline-flex shrink-0 items-center whitespace-nowrap')
  })

  it('keeps the native select outside the action buttons and does not generate on selection', () => {
    Reflect.set(globalThis, 'React', React)
    const onValueChange = vi.fn()
    const onClick = vi.fn()
    const tree = ImageGenerationInlineCountButton({
      prefix: createElement('span', null, '生成'),
      suffix: createElement('span', null, '张图像'),
      value: 3,
      options: [1, 2, 3],
      onValueChange,
      onClick,
      ariaLabel: '选择生成数量',
    }) as ReactElement<TestElementProps>

    const children = React.Children.toArray(tree.props.children) as ReactElement<TestElementProps>[]
    const actionButtons = children.filter((child) => child.type === 'button')
    const countContainer = children.find((child) => child.type === 'span')
    const select = React.Children.toArray(countContainer?.props.children)
      .find((child) => React.isValidElement(child) && child.type === 'select') as ReactElement<TestSelectProps> | undefined

    expect(actionButtons).toHaveLength(2)
    expect(select).toBeDefined()
    if (!select) throw new Error('select missing')
    select.props.onChange({ target: { value: '2' } })
    expect(onValueChange).toHaveBeenCalledWith(2)
    expect(onClick).not.toHaveBeenCalled()

    actionButtons[0]?.props.onClick?.()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders the count control as a rounded inline pill with the chevron inside it', () => {
    Reflect.set(globalThis, 'React', React)

    const html = renderToStaticMarkup(
      createElement(ImageGenerationInlineCountButton, {
        prefix: createElement('span', null, '重新生成'),
        suffix: createElement('span', null, '张'),
        value: 2,
        options: [1, 2, 3],
        onValueChange: () => undefined,
        onClick: () => undefined,
        ariaLabel: '选择重新生成数量',
      }),
    )

    expect(html).toContain('重新生成')
    expect(html).toContain('张')
    expect(html).toContain('whitespace-nowrap')
    expect(html).toContain('rounded-full bg-white/12')
    expect(html).toContain('right-2')
    expect(html).toContain('hover:bg-white/16')
  })

  it('can render a regenerate action without exposing the count selector', () => {
    Reflect.set(globalThis, 'React', React)

    const html = renderToStaticMarkup(
      createElement(ImageGenerationInlineCountButton, {
        prefix: createElement('span', null, '重新生成'),
        suffix: null,
        value: 2,
        options: [1, 2, 3],
        onValueChange: () => undefined,
        onClick: () => undefined,
        showCountControl: false,
        ariaLabel: '重新生成当前图片',
        className: 'inline-flex h-6 items-center justify-center rounded-md px-1.5',
      }),
    )

    expect(html).toContain('重新生成')
    expect(html).toContain('type="button"')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('rounded-full bg-white/12')
  })
})
