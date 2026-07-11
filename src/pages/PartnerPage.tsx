import { useState } from 'react'
import { Gift, Sparkles, Check, Info, PawPrint, X } from 'lucide-react'
import { usePartner, type OpenResult } from '@/store/partner'
import { BREEDS, BREED_MAP } from '@/features/partner/breeds'
import {
  RARITY_META,
  RARITY_ORDER,
  NORMAL_ODDS,
  GUARANTEED_ODDS,
  PITY_LIMIT,
  type BoxKind,
  type Rarity,
} from '@/features/partner/gacha'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'

export function PartnerPage() {
  const [tab, setTab] = useState<'box' | 'dex'>('box')
  const boxes = usePartner((s) => s.boxes)
  const dogs = usePartner((s) => s.dogs)
  const pity = usePartner((s) => s.pity)
  const activeUid = usePartner((s) => s.activePartnerUid)
  const openBox = usePartner((s) => s.openBox)
  const setActive = usePartner((s) => s.setActive)

  const [opening, setOpening] = useState<BoxKind | null>(null)
  const [reveal, setReveal] = useState<OpenResult | null>(null)
  const [oddsOpen, setOddsOpen] = useState(false)

  const active = dogs.find((d) => d.uid === activeUid)
  const activeBreed = active ? BREED_MAP[active.breedId] : undefined

  const doOpen = (kind: BoxKind) => {
    if (boxes[kind] <= 0 || opening) return
    const res = openBox(kind)
    if (!res) return
    setOpening(kind)
    // 흔들림 연출 후 공개
    setTimeout(() => {
      setOpening(null)
      setReveal(res)
    }, 1300)
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">파트너</h1>
        <button
          onClick={() => setOddsOpen(true)}
          className="flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-fg-muted"
        >
          <Info size={13} /> 확률
        </button>
      </header>

      {/* 대표 파트너 */}
      <div className="flex items-center gap-4 rounded-3xl bg-surface p-4">
        {activeBreed ? (
          <>
            <RarityTile emoji={activeBreed.emoji} rarity={activeBreed.rarity} size={64} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-fg-muted">대표 파트너</p>
              <p className="truncate text-lg font-extrabold">
                {active?.nickname || activeBreed.name}
              </p>
              <RarityChip rarity={activeBreed.rarity} />
            </div>
          </>
        ) : (
          <>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-fg-muted">
              <PawPrint size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">아직 파트너가 없어요</p>
              <p className="mt-0.5 text-xs text-fg-muted">산책을 완주하고 상자를 열어보세요.</p>
            </div>
          </>
        )}
      </div>

      {/* 상자 / 도감 토글 */}
      <div className="mt-4 flex rounded-full bg-surface p-1">
        {(['box', 'dex'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
              tab === t ? 'bg-primary text-on-primary' : 'text-fg-muted'
            }`}
          >
            {t === 'box' ? '상자 열기' : `도감 ${dogs.length ? `(${ownedBreedCount(dogs)}/${BREEDS.length})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'box' ? (
        <BoxTab boxes={boxes} pity={pity} onOpen={doOpen} onOdds={() => setOddsOpen(true)} />
      ) : (
        <DexTab dogs={dogs} activeUid={activeUid} onSelect={setActive} />
      )}

      {opening && <OpeningOverlay kind={opening} />}
      {reveal && (
        <RevealOverlay
          result={reveal}
          isActive={active?.uid === reveal.dog.uid}
          onSetActive={() => setActive(reveal.dog.uid)}
          onClose={() => {
            setReveal(null)
            setTab('dex')
          }}
        />
      )}

      <OddsSheet open={oddsOpen} onClose={() => setOddsOpen(false)} pity={pity} />
    </div>
  )
}

function ownedBreedCount(dogs: { breedId: string }[]): number {
  return new Set(dogs.map((d) => d.breedId)).size
}

/* ── 상자 탭 ──────────────────────────────────────────────────────────── */
function BoxTab({
  boxes,
  pity,
  onOpen,
  onOdds,
}: {
  boxes: { normal: number; guaranteed: number }
  pity: number
  onOpen: (k: BoxKind) => void
  onOdds: () => void
}) {
  const empty = boxes.normal === 0 && boxes.guaranteed === 0
  return (
    <div className="mt-4 space-y-3">
      <BoxCard
        kind="normal"
        count={boxes.normal}
        title="일반 상자"
        desc="완주할 때마다 받아요"
        onOpen={() => onOpen('normal')}
      />
      <BoxCard
        kind="guaranteed"
        count={boxes.guaranteed}
        title="확정 상자"
        desc="5km+ 또는 3일 연속 산책 보상 · 영웅 이상 확정"
        onOpen={() => onOpen('guaranteed')}
      />

      {/* 천장 진행 */}
      <div className="rounded-2xl bg-surface p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-bold">전설(S) 천장까지</span>
          <span className="font-extrabold tabular-nums text-primary">
            {Math.max(0, PITY_LIMIT - pity)}회
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, (pity / PITY_LIMIT) * 100)}%` }}
          />
        </div>
        <button onClick={onOdds} className="mt-2 text-xs font-bold text-fg-muted underline">
          확률 자세히 보기
        </button>
      </div>

      {empty && (
        <p className="pt-6 text-center text-sm text-fg-muted">
          상자가 없어요. 산책을 완주하면 상자를 받아요.
        </p>
      )}
    </div>
  )
}

function BoxCard({
  kind,
  count,
  title,
  desc,
  onOpen,
}: {
  kind: BoxKind
  count: number
  title: string
  desc: string
  onOpen: () => void
}) {
  const disabled = count <= 0
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-4 ${
        kind === 'guaranteed'
          ? 'bg-gradient-to-r from-[#a78bfa]/20 to-surface'
          : 'bg-surface'
      }`}
    >
      <div
        className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
          kind === 'guaranteed' ? 'bg-[#a78bfa]/25 text-[#c4b5fd]' : 'bg-surface-2 text-primary'
        }`}
      >
        <Gift size={26} />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-extrabold text-on-primary">
            {count}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">{title}</p>
        <p className="mt-0.5 text-xs text-fg-muted">{desc}</p>
      </div>
      <Button size="sm" disabled={disabled} onClick={onOpen} className="shrink-0">
        {disabled ? '없음' : '열기'}
      </Button>
    </div>
  )
}

/* ── 도감 탭 ──────────────────────────────────────────────────────────── */
function DexTab({
  dogs,
  activeUid,
  onSelect,
}: {
  dogs: { uid: string; breedId: string; obtainedAt: number }[]
  activeUid?: string
  onSelect: (uid: string) => void
}) {
  const byBreed = new Map<string, { uid: string; obtainedAt: number }[]>()
  for (const d of dogs) {
    const arr = byBreed.get(d.breedId) ?? []
    arr.push({ uid: d.uid, obtainedAt: d.obtainedAt })
    byBreed.set(d.breedId, arr)
  }
  return (
    <div className="mt-4 grid grid-cols-3 gap-2.5">
      {BREEDS.map((b) => {
        const owned = byBreed.get(b.id)
        const isActive = owned?.some((o) => o.uid === activeUid) ?? false
        if (!owned) {
          return (
            <div
              key={b.id}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl bg-surface/60 text-fg-muted"
            >
              <span className="text-3xl opacity-25 grayscale">{b.emoji}</span>
              <span className="text-[11px] font-bold opacity-50">???</span>
            </div>
          )
        }
        return (
          <button
            key={b.id}
            onClick={() => onSelect(owned[0].uid)}
            className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl bg-surface active:brightness-110 ${
              isActive ? 'ring-2 ring-primary' : ''
            }`}
          >
            {owned.length > 1 && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-surface-2 px-1.5 text-[10px] font-extrabold text-fg-muted">
                ×{owned.length}
              </span>
            )}
            {isActive && (
              <span className="absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-on-primary">
                <Check size={11} strokeWidth={3} />
              </span>
            )}
            <span className="text-3xl">{b.emoji}</span>
            <span className="truncate px-1 text-[11px] font-bold">{b.name}</span>
            <span
              className="text-[10px] font-extrabold"
              style={{ color: RARITY_META[b.rarity].color }}
            >
              {b.rarity} · {RARITY_META[b.rarity].label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── 개봉/공개 연출 ───────────────────────────────────────────────────── */
function OpeningOverlay({ kind }: { kind: BoxKind }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full pb-glow"
          style={{ background: kind === 'guaranteed' ? '#a78bfa55' : '#b6f35e44' }}
        />
        <div className="pb-shake text-[96px]">🎁</div>
      </div>
    </div>
  )
}

function RevealOverlay({
  result,
  isActive,
  onSetActive,
  onClose,
}: {
  result: OpenResult
  isActive: boolean
  onSetActive: () => void
  onClose: () => void
}) {
  const breed = BREED_MAP[result.dog.breedId]
  const meta = RARITY_META[result.rarity]
  const special = result.rarity === 'A' || result.rarity === 'S'
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/85 px-8 backdrop-blur-sm">
      <button onClick={onClose} className="absolute right-4 top-4 p-2 text-fg-muted" aria-label="닫기">
        <X size={24} />
      </button>

      {result.byPity && (
        <p className="rounded-full bg-primary/20 px-3 py-1 text-xs font-extrabold text-primary">
          천장 도달 · 전설 확정!
        </p>
      )}

      <div className="relative pb-reveal">
        {special && (
          <span
            className="absolute -inset-6 rounded-full blur-2xl pb-glow"
            style={{ background: `${meta.color}66` }}
          />
        )}
        <RarityTile emoji={breed.emoji} rarity={result.rarity} size={132} />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <RarityChip rarity={result.rarity} big />
        <p className="text-2xl font-extrabold">{breed.name}</p>
        <p className="max-w-[260px] text-sm text-fg-muted">{breed.desc}</p>
      </div>

      <div className="flex w-full max-w-[280px] flex-col gap-2">
        {!isActive && (
          <Button size="lg" onClick={onSetActive}>
            <Sparkles size={18} /> 대표 파트너로 설정
          </Button>
        )}
        <Button variant="surface" size="lg" onClick={onClose}>
          {isActive ? '확인' : '나중에'}
        </Button>
      </div>
    </div>
  )
}

/* ── 공용 요소 ────────────────────────────────────────────────────────── */
function RarityTile({ emoji, rarity, size }: { emoji: string; rarity: Rarity; size: number }) {
  const meta = RARITY_META[rarity]
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: `${meta.color}22`,
        border: `2px solid ${meta.color}`,
        fontSize: size * 0.5,
      }}
    >
      {emoji}
    </div>
  )
}

function RarityChip({ rarity, big }: { rarity: Rarity; big?: boolean }) {
  const meta = RARITY_META[rarity]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-extrabold ${
        big ? 'px-3 py-1 text-sm' : 'mt-1 px-2 py-0.5 text-[11px]'
      }`}
      style={{ background: `${meta.color}22`, color: meta.color }}
    >
      {rarity} · {meta.label}
    </span>
  )
}

function OddsSheet({
  open,
  onClose,
  pity,
}: {
  open: boolean
  onClose: () => void
  pity: number
}) {
  return (
    <Sheet open={open} onClose={onClose} title="뽑기 확률 공개">
      <p className="mb-4 text-sm text-fg-muted">
        확률을 있는 그대로 공개해요. 일반 상자를 {PITY_LIMIT}회 열 때까지 전설(S)이 없으면 다음
        뽑기에 전설이 확정됩니다.
      </p>
      <OddsTable title="일반 상자" odds={NORMAL_ODDS} />
      <div className="h-4" />
      <OddsTable title="확정 상자 (영웅 이상)" odds={GUARANTEED_ODDS} />
      <p className="mt-4 text-xs text-fg-muted">
        현재 천장 카운터: {pity} / {PITY_LIMIT}
      </p>
      <Button size="lg" className="mt-6 w-full" onClick={onClose}>
        확인
      </Button>
    </Sheet>
  )
}

function OddsTable({ title, odds }: { title: string; odds: Record<Rarity, number> }) {
  return (
    <div>
      <p className="mb-2 text-sm font-extrabold">{title}</p>
      <div className="space-y-1.5">
        {[...RARITY_ORDER].reverse().map((r) => {
          const meta = RARITY_META[r]
          return (
            <div key={r} className="flex items-center gap-2">
              <span
                className="w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-extrabold"
                style={{ background: `${meta.color}22`, color: meta.color }}
              >
                {r} {meta.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${odds[r]}%`, background: meta.color }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums">
                {odds[r]}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
