import '@angular/compiler';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SpeakingService as SpeakingApiService, SpeakingVoice } from '@flashmind/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SPEAKING_DEFAULT_SYSTEM_PROMPT,
  type SpeakingSettings,
  SPEAKING_DEFAULT_SETTINGS,
} from '../../../components/speaking/speaking.domain';
import { SpeakingRepository } from '../../../components/speaking/speaking.repository';
import { logSpeakingAudio } from '../../../components/speaking/speaking-audio-diagnostics';
import { SettingsSpeakingComponent } from './settings-speaking.component';

describe('SettingsSpeakingComponent', () => {
  let fixture: ComponentFixture<SettingsSpeakingComponent>;
  let component: SettingsSpeakingComponent;
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let repositoryMock: {
    loadSettings: ReturnType<typeof vi.fn>;
    saveSettings: ReturnType<typeof vi.fn>;
  };

  const loadedSettings: SpeakingSettings = {
    interactionMode: 'TURN_BASED',
    autoPlayVoice: false,
    showTranscript: true,
    showCost: true,
    autoTranslate: true,
    systemPrompt: 'custom prompt',
    voice: SpeakingVoice.Alloy,
    memory: 'my memory',
    autoMemoryEnabled: false,
  };

  beforeEach(async () => {
    localStorage.clear();
    routerMock = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    repositoryMock = {
      loadSettings: vi.fn(() => ({ ...loadedSettings })),
      saveSettings: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsSpeakingComponent],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: SpeakingRepository, useValue: repositoryMock },
        {
          provide: SpeakingApiService,
          useValue: {
            previewSpeakingVoice: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsSpeakingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('初始載入時不應誤判為未儲存變更', () => {
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('可切換並保存即時對話模式', async () => {
    component.interactionModeControl.setValue('REALTIME');

    await component.onSave();

    expect(repositoryMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ interactionMode: 'REALTIME' }),
    );
    expect(routerMock.navigate).toHaveBeenCalledWith(['/speaking']);
  });

  it('沒有設定異動時按返回應回到口說練習', async () => {
    await component.onBack();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/speaking']);
  });

  it('可切換並保存可打斷的真即時對話模式', async () => {
    component.interactionModeControl.setValue('FULL_DUPLEX');

    await component.onSave();

    expect(repositoryMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ interactionMode: 'FULL_DUPLEX' }),
    );
  });

  it('可關閉 Speaking 花費顯示', async () => {
    component.showCostControl.setValue(false);

    await component.onSave();

    expect(repositoryMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ showCost: false }),
    );
  });

  it('可關閉 AI 逐字稿的預設展開', async () => {
    component.showTranscriptControl.setValue(false);

    await component.onSave();

    expect(repositoryMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ showTranscript: false }),
    );
    expect(fixture.nativeElement.textContent).toContain('預設顯示 AI 逐字稿');
  });

  it('設定頁不應顯示 AI 聲音選擇與試聽介面', () => {
    expect(
      fixture.nativeElement.querySelector('[data-testid="speaking-settings-voice"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('試聽語音');
  });

  it('可從設定頁複製音訊診斷記錄', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    logSpeakingAudio('playback.overlap-detected', { itemId: 'item-1' });

    await component.onCopyAudioDiagnostics();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('playback.overlap-detected'));
    expect(component.diagnosticActionMessage()).toBe('已複製 1 筆記錄');
  });

  it('可從設定頁匯出音訊診斷記錄', () => {
    logSpeakingAudio('realtime.response.done', { responseId: 'response-1' });
    const click = vi.fn();
    const anchor = document.createElement('a');
    anchor.click = click;
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:diagnostics');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    component.onExportAudioDiagnostics();

    expect(createObjectURL).toHaveBeenCalled();
    expect(anchor.download).toMatch(/^flashmind-speaking-audio-logs-\d{4}-\d{2}-\d{2}\.json$/);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagnostics');
    expect(component.diagnosticActionMessage()).toBe('已匯出 1 筆記錄');
    createElementSpy.mockRestore();
  });

  it('使用放棄變更彈窗確認後，不應再觸發第二個離開 alert', async () => {
    component.autoTranslateControl.setValue(!loadedSettings.autoTranslate);
    expect(component.hasUnsavedChanges()).toBe(true);

    await component.onBack();
    expect(component.discardModalOpen()).toBe(true);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await component.onConfirmDiscard();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/speaking']);
    expect(component.canDeactivate()).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('有未儲存變更且非放棄流程時，仍應顯示離開確認', () => {
    component.memoryControl.setValue(`${SPEAKING_DEFAULT_SETTINGS.memory} changed`);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    expect(component.canDeactivate()).toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith('你有未儲存的口說設定，確定要離開嗎？');
  });

  it('載入空提示詞時，欄位應顯示預設提示詞', () => {
    repositoryMock.loadSettings.mockReturnValue({
      ...loadedSettings,
      systemPrompt: '',
    });

    const nextFixture = TestBed.createComponent(SettingsSpeakingComponent);
    const nextComponent = nextFixture.componentInstance;
    nextFixture.detectChanges();

    expect(nextComponent.systemPromptControl.value).toBe(SPEAKING_DEFAULT_SYSTEM_PROMPT);
    nextFixture.destroy();
  });

  it('重設提示詞時應填入預設提示詞', () => {
    component.systemPromptControl.setValue('my custom prompt');

    component.onResetSystemPrompt();

    expect(component.systemPromptControl.value).toBe(SPEAKING_DEFAULT_SYSTEM_PROMPT);
  });

  it('儲存時若提示詞等於預設值，應轉成空字串以沿用後端預設', async () => {
    component.systemPromptControl.setValue(SPEAKING_DEFAULT_SYSTEM_PROMPT);

    await component.onSave();

    expect(repositoryMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: '',
      }),
    );
  });
});
