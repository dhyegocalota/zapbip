import { LegalDocument } from './legal-links';
import type { LegalText } from './legal-copy';

export const CHINESE_LEGAL_COPY: Record<LegalDocument, LegalText> = {
  [LegalDocument.Terms]: {
    title: '使用条款',
    description: '使用 zapbip（面向 AI 智能体的 WhatsApp 渠道，由巴西 Logic Bit 打造）的规则。',
    summary: '本条款是你与 {tradeName} 之间关于使用 zapbip 的协议。加入候补名单，或在 WhatsApp 上给 zapbip 发消息，即表示你接受本条款。',
    updated: '最后更新：{updatedOn}',
    sections: [
      {
        heading: '我们是谁',
        paragraphs: [
          'zapbip 是 {tradeName} 提供的服务，{tradeName} 是 {legalName} 的商号，CNPJ {cnpj}，{address}。联系方式：{contactEmail}。',
        ],
        items: [],
      },
      {
        heading: 'zapbip 做什么',
        paragraphs: [
          'zapbip 通过 Meta 官方的 WhatsApp Business 平台，把你选择的 AI 智能体（例如 {agents} 或任何 MCP 客户端）连接到你自己的 WhatsApp。你的智能体可以给你发消息、向你提问并接收你的回复。zapbip 只与你对话，绝不会给你的联系人或其他任何人发消息。',
          'zapbip 目前处于抢先体验阶段。账户通过候补名单邀请开放，功能可能随时调整。',
        ],
        items: [],
      },
      {
        heading: '你的账户',
        paragraphs: [],
        items: [
          '你的账户就是你的 WhatsApp 号码。你通过给 zapbip 发消息来登录，没有密码。',
          '消息会从 zapbip 的号码发给你。目前尚不支持把你自己的号码连接为发送方。',
          '你必须年满 18 周岁，并具备订立合同的能力。',
          '请妥善保密每个智能体的密钥。持有密钥的人可以冒用该智能体给你发消息，所以一旦泄露请立即撤销。',
          '通过你的账户和智能体发生的一切，由你自己负责。',
        ],
      },
      {
        heading: '你的智能体',
        paragraphs: [
          '你的智能体是你自行选择并运行的软件。zapbip 负责传递它们的消息和你的回复，但不会编写、检查或控制它们说什么、做什么。你根据智能体的消息（例如用按钮回复）所做的决定，由你自己负责。你的智能体背后的 AI 服务商有各自的条款。',
        ],
        items: [],
      },
      {
        heading: '可接受的使用',
        paragraphs: ['对于违反这些规则的账户，我们可能会暂停或关闭，并可能向有关部门报告违法行为。'],
        items: [
          '只用 zapbip 与你自己的智能体对话。',
          '不要发送垃圾信息、违法内容，或违反 Meta WhatsApp Business 政策的内容。',
          '不要试图通过 zapbip 联系其他人、绕过其限制，或入侵本服务或其他账户。',
          '不要转售 zapbip，也不要使其过载。',
        ],
      },
      {
        heading: '套餐与价格',
        paragraphs: [
          '免费套餐包含 {free} 条消息，可免费试用 zapbip。网站上的付费套餐和价格仅在计费开放后适用，你在付款前会看到并确认价格。凡是会影响你的价格变动，我们都会提前告知。',
        ],
        items: [],
      },
      {
        heading: '服务可用性',
        paragraphs: [
          '我们会努力让 zapbip 保持运行，但服务按现状提供，不保证始终可用，也不保证每条消息都能送达。它依赖于 Meta、Cloudflare 和互联网。请勿将 zapbip 用于紧急情况，或任何消息延迟、丢失可能造成伤害的场景。',
        ],
        items: [],
      },
      {
        heading: '责任',
        paragraphs: [
          '在巴西法律允许的范围内，对于间接损失、利润损失，以及因你的智能体、第三方服务或延迟、未送达的消息造成的损失，{tradeName} 不承担责任。本条款中的任何内容都不限制你依据巴西《消费者保护法典》（第 8.078/1990 号法律）或其他不可放弃的法律所享有的权利。',
        ],
        items: [],
      },
      {
        heading: '终止你的账户',
        paragraphs: [
          '你可以随时在 WhatsApp 上向 zapbip 发送 “删除账户” 来删除账户。对于违反本条款的账户，我们可能会关闭，也可能在提前通知后终止服务。隐私政策说明了你的数据会如何处理。',
        ],
        items: [],
      },
      {
        heading: '本条款的变更',
        paragraphs: [
          '我们可能会更新本条款；顶部的日期表示当前版本。重大变更生效前，我们会通过 WhatsApp 或本网站通知你。变更后继续使用 zapbip，即表示你接受新条款。',
        ],
        items: [],
      },
      {
        heading: '适用法律与法院',
        paragraphs: [
          '本条款适用巴西法律。争议由米纳斯吉拉斯州贝洛奥里藏特的法院管辖，除非法律允许你作为消费者向你居住地的法院提起诉讼。本条款以葡萄牙语撰写并翻译为中文；如两个版本不一致，以葡萄牙语版本为准。',
        ],
        items: [],
      },
      { heading: '联系我们', paragraphs: ['关于本条款的问题：{contactEmail}。'], items: [] },
    ],
  },
  [LegalDocument.Privacy]: {
    title: '隐私政策',
    description: 'zapbip 收集什么、为什么收集、保存多久，以及你在巴西《通用数据保护法》（LGPD）下的权利。',
    summary:
      'zapbip 只保存在你与智能体之间传递消息所必需的信息，并在固定期限后删除每一项数据。本政策遵循巴西《通用数据保护法》（第 13.709/2018 号法律，即 LGPD）。',
    updated: '最后更新：{updatedOn}',
    sections: [
      {
        heading: '谁负责',
        paragraphs: [
          '{tradeName}（{legalName}，CNPJ {cnpj}，{address}）是你个人数据的控制者。你可以通过 {contactEmail} 联系我们的数据保护官。',
        ],
        items: [],
      },
      {
        heading: '我们收集什么',
        paragraphs: [],
        items: [
          '候补名单：你的邮箱、页面语言和邀请数据（谁邀请了你、你邀请了多少人）。不会随之保存 IP 地址。',
          '账户：你的 WhatsApp 号码、语言和加入日期。',
          '智能体：你连接的每个智能体的名称、应用告知我们时它所运行的应用、创建时间和最近活跃时间。每个智能体的密钥只以摘要形式保存。',
          '消息：你与智能体之间的文字、提问、按钮和回复，以及你们交换的照片和文件。',
          '网页应用：你在 app.zapbip.com 登录时的会话 Cookie。',
          '技术数据：你使用网站或服务时，我们的托管服务商 Cloudflare 会处理 IP 地址等请求数据，以提供并保护服务。',
        ],
      },
      {
        heading: '我们为什么使用这些数据',
        paragraphs: ['我们不出售你的数据，不展示广告，也不会用你的消息训练 AI 模型。'],
        items: [
          '提供你所要求的服务：在你与智能体之间传递消息并运营你的账户（LGPD 第 7 条 V 项）。',
          '管理候补名单并向你发送相关邮件（加入时的欢迎邮件、使用资格的最新消息和邀请），基于你加入时给予的同意（第 7 条 I 项）。',
          '保障 zapbip 的安全并防止滥用，例如候补名单表单上的验证码和频率限制（正当利益，第 7 条 IX 项）。',
          '履行法定义务（第 7 条 II 项）。',
        ],
      },
      {
        heading: '我们保存多久',
        paragraphs: ['日志中绝不会包含你的消息内容。'],
        items: [
          '等待你或某个智能体处理的消息和提问：{messageDays} 天。',
          '照片和文件：{mediaDays} 天。',
          '网页应用会话：最长 {sessionDays} 天，或直到你退出登录。',
          '账户和智能体：直到你删除账户。',
          '候补名单：直到你获得使用资格或要求我们将你移除。',
        ],
      },
      {
        heading: '我们与谁共享',
        paragraphs: [
          '我们只与运营 zapbip 的服务商共享数据。你的智能体会收到你发给它们的消息；它们在你的控制下，并依据各自服务商的条款运行。当法律或法院要求时，我们也可能披露数据。',
        ],
        items: [
          'Meta Platforms：通过官方的 WhatsApp Business 平台传递每一条 WhatsApp 消息。',
          'Cloudflare：托管服务及其存储，并运行候补名单表单上的验证码（Turnstile）。',
          'Mintlify：托管 docs.zapbip.com 上的文档。',
          'Resend：发送我们的邮件，例如候补名单的欢迎邮件。',
        ],
      },
      {
        heading: '跨境传输',
        paragraphs: [
          'Meta、Cloudflare 和 Resend 会在巴西境外的服务器上处理数据，包括美国。这些传输是提供服务所必需的，并遵循 LGPD 的保障措施（第 33 条）。',
        ],
        items: [],
      },
      {
        heading: 'Cookie',
        paragraphs: [
          '本网站只设置两个自有 Cookie，用于记住你的语言和主题；网页应用会在你登录时设置一个会话 Cookie。没有广告或跟踪 Cookie。',
        ],
        items: [],
      },
      {
        heading: '你的权利',
        paragraphs: [
          '要删除你的账户及其中的一切内容，请在 WhatsApp 上向 zapbip 发送 “删除账户”。其他事项请写信至 {contactEmail}；我们会在 15 天内回复。',
        ],
        items: [
          '确认我们是否处理你的数据，并查阅这些数据。',
          '更正不完整或错误的数据。',
          '要求对不必要的数据进行匿名化、封存或删除。',
          '要求将你的数据转移给另一服务商。',
          '了解我们与谁共享数据。',
          '随时撤回你的同意。',
          '向巴西国家数据保护局（ANPD）投诉。',
        ],
      },
      {
        heading: 'Meta 和 Cloudflare 保留的内容',
        paragraphs: [
          '你删除账户后，Meta 会在其一侧保留 WhatsApp 聊天记录，Cloudflare 会保留备份副本，各自按其保留期限执行。如需从你的手机上移除，请在 WhatsApp 中删除该聊天。',
        ],
        items: [],
      },
      {
        heading: '安全',
        paragraphs: ['所有连接均使用 HTTPS。智能体密钥和网页应用会话只以摘要形式保存，每个智能体都有自己的密钥，你可以随时撤销。'],
        items: [],
      },
      { heading: '儿童', paragraphs: ['zapbip 不面向 18 岁以下的人群，我们也不会在知情的情况下收集他们的数据。'], items: [] },
      {
        heading: '本政策的变更',
        paragraphs: [
          '我们可能会更新本政策；顶部的日期表示当前版本，重大变更生效前我们会通知你。本政策以葡萄牙语撰写并翻译为中文；如两个版本不一致，以葡萄牙语版本为准。',
        ],
        items: [],
      },
    ],
  },
};
