import { colors } from '@toss/tds-colors';
import { FixedBottomCTA, Text, Top } from '@toss/tds-mobile';

interface PlaceholderScreenProps {
  title: string;
  description: string;
  onDone: () => void;
}

/** 5단계에서 만들 화면의 자리. 라우트·뒤로가기만 동작해요. */
export function PlaceholderScreen({ title, description, onDone }: PlaceholderScreenProps) {
  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>{title}</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>{description}</Top.SubtitleParagraph>}
      />
      <div style={{ padding: '0 20px 120px' }}>
        <Text typography="t6" color={colors.grey600}>
          이 화면은 5단계(구현)에서 만들어요. 설계는 steps/3-design/wireframes/mandalart-flow.md 에 있어요.
        </Text>
      </div>
      <FixedBottomCTA onClick={onDone}>홈으로</FixedBottomCTA>
    </>
  );
}
