package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	speakingDuration = 60 * time.Second
	sideWaitDuration = 10 * time.Second
	cooldownDuration = 30 * time.Second
	disconnectGrace  = 30 * time.Second
)

type DebateSide string
type RoomStatus string
type TopicCategory string

const (
	SideUnassigned DebateSide = "unassigned"
	SidePro        DebateSide = "pro"
	SideCon        DebateSide = "con"

	StatusWaiting RoomStatus = "waiting"
	StatusActive  RoomStatus = "active"
)

type DebateTopic struct {
	Title string `json:"title"`
	Pro   string `json:"pro"`
	Con   string `json:"con"`
}

type Persona struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Voice string `json:"voice"`
}

type Participant struct {
	ID             string     `json:"id"`
	IsHost         bool       `json:"isHost"`
	Side           DebateSide `json:"side"`
	Persona        Persona    `json:"persona"`
	JoinedAt       int64      `json:"joinedAt"`
	IsOnline       bool       `json:"isOnline"`
	DisconnectedAt *int64     `json:"disconnectedAt"`
}

type RoomState struct {
	RoomID           string           `json:"roomId"`
	Category         TopicCategory    `json:"category"`
	MaxParticipants  int              `json:"maxParticipants"`
	Status           RoomStatus       `json:"status"`
	CurrentSide      DebateSide       `json:"currentSide"`
	CurrentSpeakerID *string          `json:"currentSpeakerId"`
	SpeakingEndsAt   *int64           `json:"speakingEndsAt"`
	SideWaitingSince *int64           `json:"sideWaitingSince"`
	Topic            DebateTopic      `json:"topic"`
	Participants     []Participant    `json:"participants"`
	ProQueue         []string         `json:"proQueue"`
	ConQueue         []string         `json:"conQueue"`
	Cooldowns        map[string]int64 `json:"cooldowns"`
}

type ClientMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type ServerMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type VoiceSignalPayload struct {
	Target     string          `json:"target"`
	SignalType string          `json:"signalType"`
	Payload    json.RawMessage `json:"payload"`
}

type ForwardedVoiceSignal struct {
	From       string          `json:"from"`
	SignalType string          `json:"signalType"`
	Payload    json.RawMessage `json:"payload"`
}

type CreateRoomRequest struct {
	Category        TopicCategory `json:"category"`
	MaxParticipants int           `json:"maxParticipants"`
}

type JoinRoomResponse struct {
	Room   *RoomState `json:"room"`
	UserID string     `json:"userId"`
}

type RoomSummary struct {
	RoomID           string        `json:"roomId"`
	Category         TopicCategory `json:"category"`
	Status           RoomStatus    `json:"status"`
	TopicTitle       string        `json:"topicTitle"`
	ParticipantCount int           `json:"participantCount"`
	OnlineCount      int           `json:"onlineCount"`
	MaxParticipants  int           `json:"maxParticipants"`
	CanJoin          bool          `json:"canJoin"`
	CreatedAt        int64         `json:"createdAt"`
}

type RoomHub struct {
	mu               sync.Mutex
	rooms            map[string]*RoomState
	clients          map[string]map[*websocket.Conn]ClientInfo
	disconnectTimers map[string]map[string]*time.Timer
}

type ClientInfo struct {
	UserID string
}

type ServerConfig struct {
	Port            string
	AllowedOrigins  map[string]bool
	AllowAllOrigins bool
}

var hub = &RoomHub{
	rooms:            map[string]*RoomState{},
	clients:          map[string]map[*websocket.Conn]ClientInfo{},
	disconnectTimers: map[string]map[string]*time.Timer{},
}

var serverConfig = loadConfig()
var upgrader = websocket.Upgrader{CheckOrigin: isAllowedOrigin}

var personas = []Persona{
	{ID: "bear", Name: "熊", Icon: "熊", Voice: "低沉厚重"},
	{ID: "dog", Name: "狗", Icon: "狗", Voice: "活泼偏高"},
	{ID: "cat", Name: "猫", Icon: "猫", Voice: "轻柔尖细"},
	{ID: "bird", Name: "鸟", Icon: "鸟", Voice: "清亮快速"},
	{ID: "robot", Name: "机器人", Icon: "机", Voice: "电子质感"},
	{ID: "alien", Name: "外星人", Icon: "外", Voice: "空间变调"},
}

var topics = map[TopicCategory][]DebateTopic{
	"technology": {
		{Title: "AI 会让普通人的工作机会变多还是变少？", Pro: "正方：机会变多", Con: "反方：机会变少"},
		{Title: "自动驾驶普及后，城市是否应该减少私人汽车？", Pro: "正方：应该减少", Con: "反方：不应减少"},
		{Title: "中小学生是否应该系统学习 AI 工具？", Pro: "正方：应该学习", Con: "反方：不宜过早"},
		{Title: "AI 生成内容是否应该强制打水印？", Pro: "正方：应该强制", Con: "反方：不应强制"},
		{Title: "智能家居让生活更便利还是更不安全？", Pro: "正方：更便利", Con: "反方：更不安全"},
		{Title: "短期内人类驾驶是否应该被自动驾驶限制？", Pro: "正方：应该限制", Con: "反方：不应限制"},
		{Title: "算法推荐是否应该允许用户一键关闭？", Pro: "正方：应该允许", Con: "反方：不必强制"},
		{Title: "可穿戴设备是否会改善大众健康？", Pro: "正方：会改善", Con: "反方：作用有限"},
		{Title: "AI 客服是否应该取代大部分人工客服？", Pro: "正方：应该取代", Con: "反方：不应取代"},
		{Title: "个人数据能否作为用户自己的资产交易？", Pro: "正方：可以交易", Con: "反方：不应交易"},
		{Title: "学校是否应该允许学生用 AI 完成作业初稿？", Pro: "正方：应该允许", Con: "反方：不应允许"},
		{Title: "开源 AI 模型利大于弊还是弊大于利？", Pro: "正方：利大于弊", Con: "反方：弊大于利"},
		{Title: "社交平台是否应该公开推荐算法的大致逻辑？", Pro: "正方：应该公开", Con: "反方：无需公开"},
		{Title: "虚拟现实办公会成为主流吗？", Pro: "正方：会成为主流", Con: "反方：不会成为主流"},
		{Title: "手机是否应该默认限制未成年人使用时长？", Pro: "正方：应该限制", Con: "反方：不应默认限制"},
		{Title: "AI 医疗诊断是否可以作为首诊入口？", Pro: "正方：可以作为入口", Con: "反方：不应作为入口"},
		{Title: "数字人主播是否会削弱真人主播价值？", Pro: "正方：会削弱", Con: "反方：不会削弱"},
		{Title: "科技公司是否应该对用户沉迷承担更多责任？", Pro: "正方：应该承担", Con: "反方：责任有限"},
		{Title: "无现金社会是否更值得期待？", Pro: "正方：值得期待", Con: "反方：不值得期待"},
		{Title: "脑机接口商业化是否应该谨慎放慢？", Pro: "正方：应该放慢", Con: "反方：不应放慢"},
		{Title: "AI 陪伴产品能否缓解孤独？", Pro: "正方：能够缓解", Con: "反方：难以缓解"},
		{Title: "人脸识别在公共场所是否应该严格限制？", Pro: "正方：应该限制", Con: "反方：不应严格限制"},
	},
	"society": {
		{Title: "匿名社交让人更真诚还是更失控？", Pro: "正方：更真诚", Con: "反方：更失控"},
		{Title: "公共场所是否应该全面限制外放声音？", Pro: "正方：应该限制", Con: "反方：不应全面限制"},
		{Title: "城市是否应该对宠物出入公共空间更宽容？", Pro: "正方：应该更宽容", Con: "反方：不应更宽容"},
		{Title: "高铁静音车厢是否应该扩大覆盖？", Pro: "正方：应该扩大", Con: "反方：不应扩大"},
		{Title: "年轻人选择不婚是否应该被视为正常生活方式？", Pro: "正方：应该视为正常", Con: "反方：不应过度鼓励"},
		{Title: "社区是否应该强制垃圾分类处罚？", Pro: "正方：应该处罚", Con: "反方：不应强制处罚"},
		{Title: "公共事件中网民实名发言是否更有利？", Pro: "正方：更有利", Con: "反方：更不利"},
		{Title: "城市夜经济是否应该延长营业限制？", Pro: "正方：应该放宽", Con: "反方：不应放宽"},
		{Title: "见义勇为是否应该给予更高经济奖励？", Pro: "正方：应该更高", Con: "反方：不应过高"},
		{Title: "社区团购对普通消费者是好事吗？", Pro: "正方：是好事", Con: "反方：不一定"},
		{Title: "公共交通是否应该对高峰期大件行李限流？", Pro: "正方：应该限流", Con: "反方：不应限流"},
		{Title: "网络暴力是否应该提高违法成本？", Pro: "正方：应该提高", Con: "反方：谨慎提高"},
		{Title: "城市是否应该建设更多 24 小时公共空间？", Pro: "正方：应该建设", Con: "反方：不应优先"},
		{Title: "社会评价是否过度看重学历？", Pro: "正方：过度看重", Con: "反方：并未过度"},
		{Title: "公共服务是否应该优先数字化？", Pro: "正方：应该优先", Con: "反方：不应优先"},
		{Title: "热门景区是否应该实行更严格预约制？", Pro: "正方：应该严格", Con: "反方：不应严格"},
		{Title: "外卖平台是否应该限制超低价竞争？", Pro: "正方：应该限制", Con: "反方：不应限制"},
		{Title: "城市是否应该鼓励更多共享空间替代私人空间？", Pro: "正方：应该鼓励", Con: "反方：不应鼓励"},
		{Title: "社会是否应该更重视失败教育？", Pro: "正方：应该重视", Con: "反方：不必强调"},
		{Title: "公共场合拍摄他人是否应该默认需要同意？", Pro: "正方：需要同意", Con: "反方：不应默认需要"},
		{Title: "老旧小区加装电梯是否应该少数服从多数？", Pro: "正方：应该", Con: "反方：不应该"},
		{Title: "城市流浪动物治理应以收容为主还是绝育放归为主？", Pro: "正方：收容为主", Con: "反方：绝育放归为主"},
	},
	"workplace": {
		{Title: "远程办公会提升效率还是削弱协作？", Pro: "正方：提升效率", Con: "反方：削弱协作"},
		{Title: "职场新人应该优先追求成长还是稳定？", Pro: "正方：优先成长", Con: "反方：优先稳定"},
		{Title: "加班文化是否正在被年轻人真正改变？", Pro: "正方：正在改变", Con: "反方：没有改变"},
		{Title: "求职时薪资透明是否应该成为行业标准？", Pro: "正方：应该透明", Con: "反方：不应强制"},
		{Title: "职场中情绪价值是否和专业能力同样重要？", Pro: "正方：同样重要", Con: "反方：专业更重要"},
		{Title: "跳槽频繁会提升职业竞争力吗？", Pro: "正方：会提升", Con: "反方：会削弱"},
		{Title: "公司是否应该允许员工公开讨论薪资？", Pro: "正方：应该允许", Con: "反方：不应允许"},
		{Title: "绩效排名末位淘汰是否合理？", Pro: "正方：合理", Con: "反方：不合理"},
		{Title: "职场新人是否应该主动承担额外工作？", Pro: "正方：应该主动", Con: "反方：不应主动"},
		{Title: "管理者更应该被结果评价还是过程评价？", Pro: "正方：结果评价", Con: "反方：过程评价"},
		{Title: "副业会帮助主业发展还是影响主业投入？", Pro: "正方：帮助发展", Con: "反方：影响投入"},
		{Title: "工作群是否应该在下班后自动免打扰？", Pro: "正方：应该自动", Con: "反方：不应自动"},
		{Title: "职场中会表达比会做事更重要吗？", Pro: "正方：更重要", Con: "反方：不更重要"},
		{Title: "年轻人第一份工作是否应该选择大公司？", Pro: "正方：应该选择", Con: "反方：不必选择"},
		{Title: "职场导师制是否真的有必要？", Pro: "正方：有必要", Con: "反方：没必要"},
		{Title: "公司团建是否应该完全自愿？", Pro: "正方：应该自愿", Con: "反方：不应完全自愿"},
		{Title: "简历包装是否可以被接受？", Pro: "正方：可以接受", Con: "反方：不能接受"},
		{Title: "职场中稳定情绪是否是一种核心能力？", Pro: "正方：是核心能力", Con: "反方：不是核心能力"},
		{Title: "企业是否应该为员工心理健康负责？", Pro: "正方：应该负责", Con: "反方：责任有限"},
		{Title: "工作年限是否仍然能代表能力？", Pro: "正方：能代表", Con: "反方：不能代表"},
		{Title: "领导魅力比制度更能激励团队吗？", Pro: "正方：更能激励", Con: "反方：制度更重要"},
		{Title: "职场中拒绝无效社交是否会影响发展？", Pro: "正方：会影响", Con: "反方：不会影响"},
	},
	"campus": {
		{Title: "大学课程应该更重视通识教育还是职业技能？", Pro: "正方：通识教育", Con: "反方：职业技能"},
		{Title: "考试成绩是否仍然是最公平的评价方式？", Pro: "正方：仍然公平", Con: "反方：不再公平"},
		{Title: "大学生是否应该强制参加社会实践？", Pro: "正方：应该强制", Con: "反方：不应强制"},
		{Title: "课堂是否应该允许学生使用手机查资料？", Pro: "正方：应该允许", Con: "反方：不应允许"},
		{Title: "高中是否应该更早开展职业规划教育？", Pro: "正方：应该更早", Con: "反方：不宜过早"},
		{Title: "大学社团经历是否比绩点更重要？", Pro: "正方：更重要", Con: "反方：绩点更重要"},
		{Title: "宿舍关系是否是大学成长的必修课？", Pro: "正方：是必修课", Con: "反方：不是必修课"},
		{Title: "校园恋爱会促进成长还是分散精力？", Pro: "正方：促进成长", Con: "反方：分散精力"},
		{Title: "大学是否应该取消早八课程？", Pro: "正方：应该取消", Con: "反方：不应取消"},
		{Title: "学生干部经历是否值得投入大量时间？", Pro: "正方：值得投入", Con: "反方：不值得投入"},
		{Title: "校园内卷主要来自制度还是个人焦虑？", Pro: "正方：来自制度", Con: "反方：来自个人焦虑"},
		{Title: "大学生是否应该尽早实习？", Pro: "正方：应该尽早", Con: "反方：不必尽早"},
		{Title: "学校是否应该限制学生使用 AI 写论文？", Pro: "正方：应该限制", Con: "反方：不应限制"},
		{Title: "课堂点名是否有助于学习？", Pro: "正方：有助于", Con: "反方：没有帮助"},
		{Title: "大学转专业门槛是否应该降低？", Pro: "正方：应该降低", Con: "反方：不应降低"},
		{Title: "奖学金是否应该更看重综合能力？", Pro: "正方：应该看重", Con: "反方：应看重成绩"},
		{Title: "校园生活是否应该更像小社会？", Pro: "正方：应该更像", Con: "反方：不应太像"},
		{Title: "研究生扩招会提升教育公平吗？", Pro: "正方：会提升", Con: "反方：不会提升"},
		{Title: "学生是否应该拥有评价教师的更大权重？", Pro: "正方：应该拥有", Con: "反方：不应过大"},
		{Title: "大学生兼职是必要体验吗？", Pro: "正方：是必要体验", Con: "反方：不是必要体验"},
		{Title: "学校是否应该开设必修理财课？", Pro: "正方：应该开设", Con: "反方：不应必修"},
		{Title: "毕业论文是否应该允许更多实践型成果替代？", Pro: "正方：应该允许", Con: "反方：不应替代"},
	},
	"relationship": {
		{Title: "恋爱中坦白一切是否真的必要？", Pro: "正方：必要", Con: "反方：不必要"},
		{Title: "朋友之间借钱是否会破坏关系？", Pro: "正方：会破坏", Con: "反方：不一定"},
		{Title: "恋爱中边界感是否比亲密感更重要？", Pro: "正方：边界更重要", Con: "反方：亲密更重要"},
		{Title: "长期关系中仪式感是否必要？", Pro: "正方：必要", Con: "反方：不必要"},
		{Title: "伴侣之间是否应该共享手机密码？", Pro: "正方：应该共享", Con: "反方：不应共享"},
		{Title: "异地恋能否真正考验爱情？", Pro: "正方：能够考验", Con: "反方：不能代表"},
		{Title: "恋爱中 AA 制是否更健康？", Pro: "正方：更健康", Con: "反方：不一定健康"},
		{Title: "朋友之间是否应该频繁表达在乎？", Pro: "正方：应该表达", Con: "反方：不必频繁"},
		{Title: "分手后还能不能做朋友？", Pro: "正方：可以做朋友", Con: "反方：不应做朋友"},
		{Title: "恋爱中安全感应该靠对方给还是自己建立？", Pro: "正方：靠对方给", Con: "反方：靠自己建立"},
		{Title: "亲密关系中讲道理比哄对方更重要吗？", Pro: "正方：讲道理重要", Con: "反方：哄对方重要"},
		{Title: "友情是否需要像爱情一样经营？", Pro: "正方：需要经营", Con: "反方：不必刻意"},
		{Title: "恋爱中门当户对是否仍然重要？", Pro: "正方：仍然重要", Con: "反方：不再重要"},
		{Title: "伴侣是否应该参与彼此的社交圈？", Pro: "正方：应该参与", Con: "反方：不必参与"},
		{Title: "暧昧期拉长会增加吸引还是消耗关系？", Pro: "正方：增加吸引", Con: "反方：消耗关系"},
		{Title: "朋友变少是否意味着人际关系质量提高？", Pro: "正方：质量提高", Con: "反方：不代表提高"},
		{Title: "恋爱中是否应该保留个人秘密？", Pro: "正方：应该保留", Con: "反方：不应保留"},
		{Title: "伴侣吵架后冷静期是否有必要？", Pro: "正方：有必要", Con: "反方：没必要"},
		{Title: "爱情中合适比喜欢更重要吗？", Pro: "正方：合适更重要", Con: "反方：喜欢更重要"},
		{Title: "朋友之间三观不同还能深交吗？", Pro: "正方：可以深交", Con: "反方：很难深交"},
		{Title: "恋爱是否应该以结婚为默认目标？", Pro: "正方：应该默认", Con: "反方：不应默认"},
		{Title: "亲密关系中经济能力是否会影响话语权？", Pro: "正方：会影响", Con: "反方：不应影响"},
		{Title: "被朋友已读不回是否应该主动追问？", Pro: "正方：应该追问", Con: "反方：不应追问"},
		{Title: "恋爱中主动报备是否是一种尊重？", Pro: "正方：是尊重", Con: "反方：不是必须"},
		{Title: "情侣是否应该保持相同消费观？", Pro: "正方：应该相同", Con: "反方：可以不同"},
		{Title: "朋友之间是否应该指出对方缺点？", Pro: "正方：应该指出", Con: "反方：谨慎指出"},
		{Title: "亲密关系中情绪稳定是否比浪漫更重要？", Pro: "正方：更重要", Con: "反方：浪漫更重要"},
		{Title: "恋爱中对方的过去重要吗？", Pro: "正方：重要", Con: "反方：不重要"},
		{Title: "成年后最好的朋友是否只能有一个？", Pro: "正方：只能有一个", Con: "反方：可以有多个"},
		{Title: "情侣同居是否是婚前必要步骤？", Pro: "正方：有必要", Con: "反方：没必要"},
		{Title: "朋友之间长期不联系还算好朋友吗？", Pro: "正方：仍然算", Con: "反方：不太算"},
		{Title: "恋爱中独立是否会削弱亲密？", Pro: "正方：会削弱", Con: "反方：不会削弱"},
		{Title: "关系里先低头的人是否更成熟？", Pro: "正方：更成熟", Con: "反方：不一定"},
		{Title: "伴侣是否应该接受彼此的全部缺点？", Pro: "正方：应该接受", Con: "反方：不应全部接受"},
		{Title: "友情中的占有欲是否可以被理解？", Pro: "正方：可以理解", Con: "反方：不应合理化"},
		{Title: "恋爱中表达需求是否比默默付出更重要？", Pro: "正方：表达更重要", Con: "反方：付出更重要"},
		{Title: "相亲是否比自由恋爱更高效？", Pro: "正方：更高效", Con: "反方：不更高效"},
		{Title: "朋友之间价值差距变大后还能平等相处吗？", Pro: "正方：可以平等", Con: "反方：很难平等"},
		{Title: "亲密关系是否应该设立明确底线清单？", Pro: "正方：应该设立", Con: "反方：不必设立"},
		{Title: "恋爱中分享欲下降是否意味着感情变淡？", Pro: "正方：意味着变淡", Con: "反方：不一定"},
		{Title: "好朋友是否应该无条件支持彼此？", Pro: "正方：应该支持", Con: "反方：不应无条件"},
		{Title: "伴侣之间互补比相似更重要吗？", Pro: "正方：互补更重要", Con: "反方：相似更重要"},
	},
	"entertainment": {
		{Title: "短视频让人更放松还是更焦虑？", Pro: "正方：更放松", Con: "反方：更焦虑"},
		{Title: "爆款影视剧是否应该更重视观众评分？", Pro: "正方：应该重视", Con: "反方：不应过度重视"},
		{Title: "综艺节目是否应该减少剧本化？", Pro: "正方：应该减少", Con: "反方：不必减少"},
		{Title: "游戏直播比传统体育更有观赏性吗？", Pro: "正方：更有观赏性", Con: "反方：不如传统体育"},
		{Title: "明星塌房后作品是否应该下架？", Pro: "正方：应该下架", Con: "反方：不应下架"},
		{Title: "二创内容是否会提升原作品价值？", Pro: "正方：会提升", Con: "反方：会稀释"},
		{Title: "电影院观影是否仍然不可替代？", Pro: "正方：不可替代", Con: "反方：可以替代"},
		{Title: "付费超前点播是否合理？", Pro: "正方：合理", Con: "反方：不合理"},
		{Title: "电子竞技是否应该进入更多校园赛事？", Pro: "正方：应该进入", Con: "反方：不应进入"},
		{Title: "粉丝应不应该为偶像数据打榜？", Pro: "正方：可以打榜", Con: "反方：不应打榜"},
		{Title: "喜剧是否应该允许更大的冒犯空间？", Pro: "正方：应该允许", Con: "反方：不应允许"},
		{Title: "影视翻拍经典是创新还是消费情怀？", Pro: "正方：是创新", Con: "反方：消费情怀"},
		{Title: "弹幕会提升观影体验吗？", Pro: "正方：会提升", Con: "反方：会破坏"},
		{Title: "演唱会高价票是否应该被限制？", Pro: "正方：应该限制", Con: "反方：不应限制"},
		{Title: "真人秀是否应该更保护素人嘉宾隐私？", Pro: "正方：应该保护", Con: "反方：无需特殊保护"},
		{Title: "游戏抽卡机制是否应该更严格监管？", Pro: "正方：应该监管", Con: "反方：不应过度监管"},
		{Title: "网红探店是否还值得信任？", Pro: "正方：值得信任", Con: "反方：不值得信任"},
		{Title: "长视频平台是否应该减少会员分层？", Pro: "正方：应该减少", Con: "反方：不必减少"},
		{Title: "娱乐新闻是否过度占用公共注意力？", Pro: "正方：过度占用", Con: "反方：并未过度"},
		{Title: "音乐短视频化会伤害音乐创作吗？", Pro: "正方：会伤害", Con: "反方：不会伤害"},
		{Title: "虚拟偶像会成为娱乐主流吗？", Pro: "正方：会成为主流", Con: "反方：不会成为主流"},
		{Title: "粉丝文化对年轻人利大于弊吗？", Pro: "正方：利大于弊", Con: "反方：弊大于利"},
	},
}

func main() {
	rand.Seed(time.Now().UnixNano())

	mux := http.NewServeMux()
	mux.HandleFunc("/health", withCORS(handleHealth))
	mux.HandleFunc("/api/rooms", withCORS(handleRooms))
	mux.HandleFunc("/api/rooms/", withCORS(handleRoomAction))
	mux.HandleFunc("/ws", handleWebSocket)

	go hub.tick()

	address := ":" + serverConfig.Port
	log.Println("debate-room-server listening on " + address)
	if err := http.ListenAndServe(address, mux); err != nil {
		log.Fatal(err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleRooms(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		writeJSON(w, http.StatusOK, hub.listRooms())
		return
	}

	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	if req.Category == "" {
		req.Category = "technology"
	}
	if req.MaxParticipants < 2 || req.MaxParticipants > 6 {
		req.MaxParticipants = 4
	}

	room, userID := hub.createRoom(req)
	writeJSON(w, http.StatusCreated, JoinRoomResponse{Room: room, UserID: userID})
}

func handleRoomAction(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/rooms/"), "/")
	if len(parts) < 2 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	roomID := parts[0]
	action := parts[1]

	switch {
	case r.Method == http.MethodPost && action == "join":
		room, userID, err := hub.joinRoom(roomID, false)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		hub.broadcast(roomID)
		writeJSON(w, http.StatusOK, JoinRoomResponse{Room: room, UserID: userID})
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	}
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("roomId")
	userID := r.URL.Query().Get("userId")
	if roomID == "" || userID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "roomId and userId required"})
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("websocket upgrade:", err)
		return
	}
	defer conn.Close()

	if hub.addClient(roomID, userID, conn) {
		hub.broadcast(roomID)
	}
	defer func() {
		if hub.removeClient(roomID, conn) {
			hub.broadcast(roomID)
		}
	}()

	hub.sendState(roomID, conn)

	for {
		var msg ClientMessage
		if err := conn.ReadJSON(&msg); err != nil {
			return
		}
		hub.handleClientMessage(roomID, userID, msg)
	}
}

func (h *RoomHub) createRoom(req CreateRoomRequest) (*RoomState, string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	roomID := "ROOM-" + randomCode(4)
	room := &RoomState{
		RoomID:          roomID,
		Category:        req.Category,
		MaxParticipants: req.MaxParticipants,
		Status:          StatusWaiting,
		CurrentSide:     SidePro,
		Topic:           pickTopic(req.Category),
		Participants:    []Participant{},
		ProQueue:        []string{},
		ConQueue:        []string{},
		Cooldowns:       map[string]int64{},
	}

	userID := "user-" + randomCode(8)
	room.Participants = append(room.Participants, h.createParticipant(room, userID, true))
	h.rooms[roomID] = room
	return cloneRoom(room), userID
}

func (h *RoomHub) joinRoom(roomID string, isHost bool) (*RoomState, string, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	room, ok := h.rooms[roomID]
	if !ok {
		return nil, "", errString("room not found")
	}
	if len(room.Participants) >= room.MaxParticipants {
		return nil, "", errString("room is full")
	}
	if room.Status != StatusWaiting {
		return nil, "", errString("room already started")
	}

	userID := "user-" + randomCode(8)
	room.Participants = append(room.Participants, h.createParticipant(room, userID, isHost))
	return cloneRoom(room), userID, nil
}

func (h *RoomHub) listRooms() []RoomSummary {
	h.mu.Lock()
	defer h.mu.Unlock()

	summaries := make([]RoomSummary, 0, len(h.rooms))
	for _, room := range h.rooms {
		createdAt := time.Now().UnixMilli()
		if len(room.Participants) > 0 {
			createdAt = room.Participants[0].JoinedAt
		}
		summaries = append(summaries, RoomSummary{
			RoomID:           room.RoomID,
			Category:         room.Category,
			Status:           room.Status,
			TopicTitle:       room.Topic.Title,
			ParticipantCount: len(room.Participants),
			OnlineCount:      onlineParticipantCount(room),
			MaxParticipants:  room.MaxParticipants,
			CanJoin:          room.Status == StatusWaiting && len(room.Participants) < room.MaxParticipants,
			CreatedAt:        createdAt,
		})
	}

	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].CreatedAt > summaries[j].CreatedAt
	})
	return summaries
}

func (h *RoomHub) addClient(roomID, userID string, conn *websocket.Conn) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.cancelDisconnectTimerLocked(roomID, userID)
	if h.clients[roomID] == nil {
		h.clients[roomID] = map[*websocket.Conn]ClientInfo{}
	}
	h.clients[roomID][conn] = ClientInfo{UserID: userID}
	room := h.rooms[roomID]
	if room == nil {
		return false
	}
	return markParticipantOnline(room, userID)
}

func (h *RoomHub) removeClient(roomID string, conn *websocket.Conn) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients := h.clients[roomID]
	if clients == nil {
		return false
	}

	info, ok := clients[conn]
	if !ok {
		return false
	}

	delete(clients, conn)

	if h.userHasOtherConnectionsLocked(roomID, info.UserID) {
		return false
	}

	return h.markParticipantDisconnectedLocked(roomID, info.UserID)
}

func (h *RoomHub) markParticipantDisconnectedLocked(roomID, userID string) bool {
	room := h.rooms[roomID]
	if room == nil {
		return false
	}
	changed := markParticipantOffline(room, userID, time.Now())
	if changed {
		h.scheduleDisconnectRemovalLocked(roomID, userID)
	}
	return changed
}

func (h *RoomHub) userHasOtherConnectionsLocked(roomID, userID string) bool {
	for _, info := range h.clients[roomID] {
		if info.UserID == userID {
			return true
		}
	}
	return false
}

func (h *RoomHub) cancelDisconnectTimerLocked(roomID, userID string) {
	roomTimers := h.disconnectTimers[roomID]
	if roomTimers == nil {
		return
	}
	if timer := roomTimers[userID]; timer != nil {
		timer.Stop()
		delete(roomTimers, userID)
	}
	if len(roomTimers) == 0 {
		delete(h.disconnectTimers, roomID)
	}
}

func (h *RoomHub) scheduleDisconnectRemovalLocked(roomID, userID string) {
	h.cancelDisconnectTimerLocked(roomID, userID)
	if h.disconnectTimers[roomID] == nil {
		h.disconnectTimers[roomID] = map[string]*time.Timer{}
	}
	h.disconnectTimers[roomID][userID] = time.AfterFunc(disconnectGrace, func() {
		if h.removeDisconnectedParticipant(roomID, userID) {
			h.broadcast(roomID)
		}
	})
}

func (h *RoomHub) removeDisconnectedParticipant(roomID, userID string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.cancelDisconnectTimerLocked(roomID, userID)
	if h.userHasOtherConnectionsLocked(roomID, userID) {
		return false
	}

	room := h.rooms[roomID]
	if room == nil {
		return false
	}

	wasCurrentSpeaker := room.CurrentSpeakerID != nil && *room.CurrentSpeakerID == userID
	changed := removeParticipant(room, userID)
	if !changed {
		return false
	}

	if len(room.Participants) == 0 {
		delete(h.rooms, roomID)
		delete(h.clients, roomID)
		delete(h.disconnectTimers, roomID)
		return false
	}

	ensureHost(room)
	if wasCurrentSpeaker {
		room.CurrentSide = oppositeSide(room.CurrentSide)
		tryStartNextSpeaker(room, time.Now())
	}
	return true
}

func (h *RoomHub) handleClientMessage(roomID, userID string, msg ClientMessage) {
	h.mu.Lock()
	room := h.rooms[roomID]
	if room == nil {
		h.mu.Unlock()
		return
	}

	switch msg.Type {
	case "start_room":
		startRoom(room, userID)
	case "request_speak":
		requestSpeak(room, userID, time.Now())
	case "request_side":
		var data struct {
			Side DebateSide `json:"side"`
		}
		if json.Unmarshal(msg.Data, &data) == nil {
			requestSideSpeak(room, data.Side)
		}
	case "end_speak":
		if room.CurrentSpeakerID != nil && *room.CurrentSpeakerID == userID {
			endSpeaking(room, time.Now())
		}
	case "leave_room":
		removeParticipant(room, userID)
		if len(room.Participants) == 0 {
			delete(h.rooms, roomID)
			delete(h.clients, roomID)
			delete(h.disconnectTimers, roomID)
		} else {
			ensureHost(room)
		}
	case "voice_signal":
		var data VoiceSignalPayload
		if json.Unmarshal(msg.Data, &data) == nil {
			h.forwardVoiceSignalLocked(roomID, userID, data)
		}
	}
	h.mu.Unlock()

	if msg.Type != "voice_signal" {
		h.broadcast(roomID)
	}
}

func (h *RoomHub) tick() {
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()

	for now := range ticker.C {
		changedRooms := []string{}
		h.mu.Lock()
		for roomID, room := range h.rooms {
			if tickRoom(room, now) {
				changedRooms = append(changedRooms, roomID)
			}
		}
		h.mu.Unlock()

		for _, roomID := range changedRooms {
			h.broadcast(roomID)
		}
	}
}

func (h *RoomHub) broadcast(roomID string) {
	h.mu.Lock()
	room := h.rooms[roomID]
	clients := make([]*websocket.Conn, 0, len(h.clients[roomID]))
	for conn := range h.clients[roomID] {
		clients = append(clients, conn)
	}
	snapshot := cloneRoom(room)
	h.mu.Unlock()

	msg := ServerMessage{Type: "room_state", Data: snapshot}
	for _, conn := range clients {
		if err := conn.WriteJSON(msg); err != nil {
			_ = h.removeClient(roomID, conn)
		}
	}
}

func (h *RoomHub) sendState(roomID string, conn *websocket.Conn) {
	h.mu.Lock()
	room := cloneRoom(h.rooms[roomID])
	h.mu.Unlock()
	_ = conn.WriteJSON(ServerMessage{Type: "room_state", Data: room})
}

func (h *RoomHub) forwardVoiceSignalLocked(roomID, fromUserID string, signal VoiceSignalPayload) {
	room := h.rooms[roomID]
	if room == nil || signal.Target == "" || signal.SignalType == "" {
		return
	}
	if findParticipant(room, fromUserID) == nil || findParticipant(room, signal.Target) == nil {
		return
	}

	message := ServerMessage{
		Type: "voice_signal",
		Data: ForwardedVoiceSignal{
			From:       fromUserID,
			SignalType: signal.SignalType,
			Payload:    signal.Payload,
		},
	}
	for conn, info := range h.clients[roomID] {
		if info.UserID == signal.Target {
			_ = conn.WriteJSON(message)
		}
	}
}

func (h *RoomHub) createParticipant(room *RoomState, userID string, isHost bool) Participant {
	return Participant{
		ID:       userID,
		IsHost:   isHost,
		Side:     SideUnassigned,
		Persona:  pickPersona(room),
		JoinedAt: time.Now().UnixMilli(),
		IsOnline: true,
	}
}

func startRoom(room *RoomState, userID string) {
	participant := findParticipant(room, userID)
	if participant == nil || !participant.IsHost {
		return
	}
	if room.Status == StatusActive || onlineParticipantCount(room) != room.MaxParticipants {
		return
	}
	assignSides(room)
	room.ProQueue = []string{}
	room.ConQueue = []string{}
	room.Status = StatusActive
	room.CurrentSide = SidePro
	tryStartNextSpeaker(room, time.Now())
}

func requestSpeak(room *RoomState, userID string, now time.Time) {
	participant := findParticipant(room, userID)
	if participant == nil || room.Status != StatusActive {
		return
	}
	if !participant.IsOnline {
		return
	}
	if participant.Side != SidePro && participant.Side != SideCon {
		return
	}
	if room.CurrentSpeakerID != nil && *room.CurrentSpeakerID == userID {
		return
	}
	if room.Cooldowns[userID] > now.UnixMilli() {
		return
	}

	queue := queueForSide(room, participant.Side)
	if contains(*queue, userID) {
		return
	}

	*queue = append(*queue, userID)
	room.Cooldowns[userID] = now.Add(cooldownDuration).UnixMilli()

	if room.CurrentSpeakerID == nil && room.CurrentSide == participant.Side {
		tryStartNextSpeaker(room, now)
	}
}

func requestSideSpeak(room *RoomState, side DebateSide) {
	queue := queueForSide(room, side)
	for _, participant := range room.Participants {
		if participant.IsOnline && participant.Side == side && (room.CurrentSpeakerID == nil || *room.CurrentSpeakerID != participant.ID) && !contains(*queue, participant.ID) {
			*queue = append(*queue, participant.ID)
			break
		}
	}

	if room.Status == StatusActive && room.CurrentSpeakerID == nil && room.CurrentSide == side {
		tryStartNextSpeaker(room, time.Now())
	}
}

func endSpeaking(room *RoomState, now time.Time) {
	if room.CurrentSpeakerID == nil {
		return
	}
	room.CurrentSpeakerID = nil
	room.SpeakingEndsAt = nil
	room.SideWaitingSince = nil
	room.CurrentSide = oppositeSide(room.CurrentSide)
	tryStartNextSpeaker(room, now)
}

func tickRoom(room *RoomState, now time.Time) bool {
	if room.CurrentSpeakerID != nil && room.SpeakingEndsAt != nil && now.UnixMilli() >= *room.SpeakingEndsAt {
		endSpeaking(room, now)
		return true
	}

	if room.Status != StatusActive || room.CurrentSpeakerID != nil {
		return false
	}

	queue := queueForSide(room, room.CurrentSide)
	if len(*queue) > 0 {
		tryStartNextSpeaker(room, now)
		return true
	}

	if room.SideWaitingSince != nil && now.UnixMilli()-*room.SideWaitingSince >= sideWaitDuration.Milliseconds() {
		room.CurrentSide = oppositeSide(room.CurrentSide)
		room.SideWaitingSince = nil
		tryStartNextSpeaker(room, now)
		return true
	}

	return false
}

func tryStartNextSpeaker(room *RoomState, now time.Time) {
	if room.Status != StatusActive || room.CurrentSpeakerID != nil {
		return
	}

	queue := queueForSide(room, room.CurrentSide)
	if len(*queue) == 0 {
		if room.SideWaitingSince == nil {
			waitingSince := now.UnixMilli()
			room.SideWaitingSince = &waitingSince
		}
		return
	}

	nextID := (*queue)[0]
	*queue = (*queue)[1:]
	room.SideWaitingSince = nil
	room.CurrentSpeakerID = &nextID
	endsAt := now.Add(speakingDuration).UnixMilli()
	room.SpeakingEndsAt = &endsAt
}

func assignSides(room *RoomState) {
	targetPro := (len(room.Participants) + 1) / 2
	order := rand.Perm(len(room.Participants))
	for index, participantIndex := range order {
		if index < targetPro {
			room.Participants[participantIndex].Side = SidePro
		} else {
			room.Participants[participantIndex].Side = SideCon
		}
	}
}

func removeParticipant(room *RoomState, userID string) bool {
	removed := false
	nextParticipants := room.Participants[:0]
	for _, participant := range room.Participants {
		if participant.ID == userID {
			removed = true
			continue
		}
		nextParticipants = append(nextParticipants, participant)
	}
	room.Participants = nextParticipants

	room.ProQueue = removeFromQueue(room.ProQueue, userID)
	room.ConQueue = removeFromQueue(room.ConQueue, userID)
	delete(room.Cooldowns, userID)

	if room.CurrentSpeakerID != nil && *room.CurrentSpeakerID == userID {
		room.CurrentSpeakerID = nil
		room.SpeakingEndsAt = nil
		room.SideWaitingSince = nil
	}

	return removed
}

func markParticipantOnline(room *RoomState, userID string) bool {
	participant := findParticipant(room, userID)
	if participant == nil {
		return false
	}
	if participant.IsOnline && participant.DisconnectedAt == nil {
		return false
	}
	participant.IsOnline = true
	participant.DisconnectedAt = nil
	return true
}

func markParticipantOffline(room *RoomState, userID string, now time.Time) bool {
	participant := findParticipant(room, userID)
	if participant == nil || !participant.IsOnline {
		return false
	}
	disconnectedAt := now.UnixMilli()
	participant.IsOnline = false
	participant.DisconnectedAt = &disconnectedAt
	room.ProQueue = removeFromQueue(room.ProQueue, userID)
	room.ConQueue = removeFromQueue(room.ConQueue, userID)
	if room.CurrentSpeakerID != nil && *room.CurrentSpeakerID == userID {
		room.CurrentSpeakerID = nil
		room.SpeakingEndsAt = nil
		room.SideWaitingSince = nil
		room.CurrentSide = oppositeSide(room.CurrentSide)
		tryStartNextSpeaker(room, now)
	}
	return true
}

func onlineParticipantCount(room *RoomState) int {
	count := 0
	for _, participant := range room.Participants {
		if participant.IsOnline {
			count++
		}
	}
	return count
}

func removeFromQueue(queue []string, userID string) []string {
	next := queue[:0]
	for _, queuedUserID := range queue {
		if queuedUserID != userID {
			next = append(next, queuedUserID)
		}
	}
	return next
}

func ensureHost(room *RoomState) {
	hasHost := false
	for _, participant := range room.Participants {
		if participant.IsHost {
			hasHost = true
			break
		}
	}
	if hasHost || len(room.Participants) == 0 {
		return
	}
	room.Participants[0].IsHost = true
}

func pickPersona(room *RoomState) Persona {
	used := map[string]bool{}
	for _, participant := range room.Participants {
		used[participant.Persona.ID] = true
	}
	available := []Persona{}
	for _, persona := range personas {
		if !used[persona.ID] {
			available = append(available, persona)
		}
	}
	if len(available) > 0 {
		return available[rand.Intn(len(available))]
	}
	return personas[rand.Intn(len(personas))]
}

func pickTopic(category TopicCategory) DebateTopic {
	pool := topics[category]
	if len(pool) == 0 {
		pool = topics["technology"]
	}
	return pool[rand.Intn(len(pool))]
}

func queueForSide(room *RoomState, side DebateSide) *[]string {
	if side == SidePro {
		return &room.ProQueue
	}
	return &room.ConQueue
}

func oppositeSide(side DebateSide) DebateSide {
	if side == SidePro {
		return SideCon
	}
	return SidePro
}

func findParticipant(room *RoomState, userID string) *Participant {
	for i := range room.Participants {
		if room.Participants[i].ID == userID {
			return &room.Participants[i]
		}
	}
	return nil
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func cloneRoom(room *RoomState) *RoomState {
	if room == nil {
		return nil
	}
	clone := *room
	clone.Participants = append([]Participant{}, room.Participants...)
	for index := range clone.Participants {
		if clone.Participants[index].DisconnectedAt != nil {
			disconnectedAt := *clone.Participants[index].DisconnectedAt
			clone.Participants[index].DisconnectedAt = &disconnectedAt
		}
	}
	clone.ProQueue = append([]string{}, room.ProQueue...)
	clone.ConQueue = append([]string{}, room.ConQueue...)
	clone.Cooldowns = map[string]int64{}
	for key, value := range room.Cooldowns {
		clone.Cooldowns[key] = value
	}
	return &clone
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if serverConfig.AllowAllOrigins {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin != "" && serverConfig.AllowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func loadConfig() ServerConfig {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	originsValue := os.Getenv("ALLOWED_ORIGINS")
	if originsValue == "" {
		originsValue = strings.Join([]string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://localhost:5174",
			"http://127.0.0.1:5174",
			"http://localhost:5175",
			"http://127.0.0.1:5175",
		}, ",")
	}

	allowedOrigins := map[string]bool{}
	allowAllOrigins := false
	for _, origin := range strings.Split(originsValue, ",") {
		origin = strings.TrimSpace(origin)
		if origin == "" {
			continue
		}
		if origin == "*" {
			allowAllOrigins = true
			continue
		}
		allowedOrigins[origin] = true
	}

	return ServerConfig{
		Port:            port,
		AllowedOrigins:  allowedOrigins,
		AllowAllOrigins: allowAllOrigins,
	}
}

func isAllowedOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	if serverConfig.AllowAllOrigins {
		return true
	}
	return serverConfig.AllowedOrigins[origin]
}

func randomCode(length int) string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	var builder strings.Builder
	for i := 0; i < length; i++ {
		builder.WriteByte(alphabet[rand.Intn(len(alphabet))])
	}
	return builder.String()
}

type errString string

func (e errString) Error() string {
	return string(e)
}
