import { View, Text, Pressable } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { authColors } from '../../theme/authTheme'
import { onboardingHeaderStyles } from '../../theme/onboardingLayout'

export default function OnboardingBackRow({ onPress, accessibilityLabel = 'Go back' }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={onboardingHeaderStyles.backWrap}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={onboardingHeaderStyles.backRow}>
        <ChevronLeft
          size={22}
          color={authColors.textPrimary}
          strokeWidth={2}
          style={onboardingHeaderStyles.backChevron}
        />
        <Text style={onboardingHeaderStyles.back}>Back</Text>
      </View>
    </Pressable>
  )
}
