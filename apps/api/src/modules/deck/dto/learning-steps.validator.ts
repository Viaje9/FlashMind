import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * 驗證學習步驟字串格式
 * 有效格式：逗號分隔的 <正整數><m|h|d>，例如 "1m,10m", "1m,10m,1h", "10m"
 */
@ValidatorConstraint({ name: 'isLearningSteps', async: false })
export class IsLearningStepsConstraint implements ValidatorConstraintInterface {
  private static readonly STEP_PATTERN = /^\d+[mhd]$/;

  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return false;
    }

    const steps = trimmed.split(',').map((s) => s.trim());

    return steps.every((step) => {
      if (!IsLearningStepsConstraint.STEP_PATTERN.test(step)) {
        return false;
      }
      // 確認數值為正整數（> 0）
      const num = parseInt(step.slice(0, -1), 10);
      return num > 0;
    });
  }

  defaultMessage(): string {
    return '學習步驟格式不正確，應為逗號分隔的時間步驟（例如 "1m,10m" 或 "1m,10m,1h"）';
  }
}

/**
 * 驗證學習步驟字串格式的裝飾器
 * 有效格式：逗號分隔的 <正整數><m|h|d>
 */
export function IsLearningSteps(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsLearningStepsConstraint,
    });
  };
}
