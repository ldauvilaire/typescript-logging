import {Category, CategoryLogger} from "../src/logging/log/category/CategoryLogger";
import {
  CategoryServiceFactory, CategoryRuntimeSettings, CategoryDefaultConfiguration,
  RuntimeSettings
} from "../src/logging/log/category/CategoryService";
import {CategoryDelegateLoggerImpl} from "../src/logging/log/category/CategoryDelegateLoggerImpl";
import {LoggerType, DateFormatEnum, LogLevel, CategoryLogFormat, DateFormat} from "../src/logging/log/LoggerOptions";
import {AbstractCategoryLogger, CategoryLogMessage} from "../src/logging/log/category/AbstractCategoryLogger";
import {LogData} from "../src/logging/log/LogData";
import {CategoryMessageBufferLoggerImpl} from "../src/logging/log/category/CategoryMessageBufferImpl";

const getBufferedMessages = (logger: CategoryLogger): string[] => {
  expect(logger instanceof CategoryDelegateLoggerImpl).toBeTruthy();
  const actualLogger = (<CategoryDelegateLoggerImpl> logger).delegate;
  expect(actualLogger instanceof CategoryMessageBufferLoggerImpl).toBeTruthy();
  return (<CategoryMessageBufferLoggerImpl> actualLogger).getMessages();
};

describe("Categories", () => {

  it("Plays with categories", () => {
    let root1 = new Category("root1");
    let root2 = new Category("root2");

    let child1 = new Category("root1_child1", root1);
    let root2Child1 = new Category("root2_child2", root2);

    let child11 = new Category("root1_child1_child11", child1);
    let child12 = new Category("root1_child1_child12", child1);

    expect(root1.parent).toBeNull();
    expect(child1.parent === root1).toBeTruthy();
    expect(root1.children.length).toEqual(1);
    expect(child1.children.length).toEqual(2);
    expect(child11.parent === child1).toBeTruthy();
    expect(child12.parent === child1).toBeTruthy();
    expect(child11.children.length).toEqual(0);
    expect(child12.children.length).toEqual(0);

    expect(root2.parent).toBeNull();
    expect(root2.children.length).toEqual(1);
    expect(root2Child1.parent === root2).toBeTruthy();
    expect(root2Child1.parent === root1).toBeFalsy();
  });

  it("Fails when forbidden character is used in category", () => {
    expect(() => new Category("abc")).not.toThrow();
    expect(() => new Category("a#")).toThrow();
  });
});

describe("CategoryServiceFactory", () => {

  let root1: Category | null = null;
  let child1: Category | null = null;
  let child11: Category | null = null;
  let child12: Category | null = null;
  let logger: CategoryLogger | null;

  beforeEach(() => {
    CategoryServiceFactory.clear();
    root1 = new Category("root1");
    child1 = new Category("child1", root1);
    child11 = new Category("child11", child1);
    child12 = new Category("child12", child1);
    logger = CategoryServiceFactory.getLogger(root1);
  });

  afterEach(() => {
    root1 = null;
    child1 = null;
    child11 = null;
    child12 = null;
    logger = null;
    CategoryServiceFactory.clear();
  });

  it("Defaults works", () => {
    expect(root1).not.toBeNull();
    expect(logger).not.toBeNull();
  });

  it("All categories have runtime settings", () => {
    const service = CategoryServiceFactory.getRuntimeSettings();
    expect(service.getCategorySettings(root1)).not.toBeNull();
    expect(service.getCategorySettings(child1)).not.toBeNull();
    expect(service.getCategorySettings(child11)).not.toBeNull();
    expect(service.getCategorySettings(child12)).not.toBeNull();
  });

  it("Only allows to fetch by root loggers", () => {
    expect(() => CategoryServiceFactory.getLogger(child1)).toThrow();
    expect(() => CategoryServiceFactory.getLogger(child11)).toThrow();
    expect(() => CategoryServiceFactory.getLogger(child12)).toThrow();
  });

  it("Allows adding root category dynamically", () => {
    // This will register it automatically.
    const extraRoot = new Category("root2");
    const child = new Category("someChild", extraRoot);

    const anotherLogger = CategoryServiceFactory.getLogger(extraRoot);
    expect(anotherLogger).not.toBeNull();
    expect(anotherLogger !== logger).toBeTruthy();

    const service = CategoryServiceFactory.getRuntimeSettings();
    expect(service.getCategorySettings(extraRoot)).not.toBeNull();
    expect(service.getCategorySettings(child)).not.toBeNull();
  });

  it("Allows adding child category dynamically", () => {
    const child121 = new Category("hello", child12);
    expect(CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child121)).not.toBeNull();
    expect(child121.getCategoryPath()).toEqual("root1#child1#child12#hello");
  });

  it("Will return the same logger for root", () => {
    const anotherLogger = CategoryServiceFactory.getLogger(root1);
    expect(anotherLogger === logger).toBeTruthy();
  });

  it("Loggers are wrapped in delegate", () => {
    let delegate = CategoryServiceFactory.getLogger(root1);
    expect(delegate instanceof CategoryDelegateLoggerImpl).toBeTruthy();
  });

  const checkDefaultConfig = (cat: Category, settings: CategoryRuntimeSettings) => {
    expect(settings.category === cat).toBeTruthy();
    expect(settings.loggerType === LoggerType.Console).toBeTruthy();
    expect(settings.logFormat.showCategoryName).toBeTruthy();
    expect(settings.logFormat.showTimeStamp).toBeTruthy();
    expect(settings.logFormat.dateFormat.dateSeparator).toEqual("-");
    expect(settings.logFormat.dateFormat.formatEnum === DateFormatEnum.Default).toBeTruthy();
    expect(settings.logLevel === LogLevel.Error).toBeTruthy();
    expect(settings.callBackLogger).toBeNull();
  };

  it("Default configuration is applied to loggers", () => {

    checkDefaultConfig(root1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(root1));
    checkDefaultConfig(child1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child1));
    checkDefaultConfig(child11, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child11));
    checkDefaultConfig(child12, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child12));

    const root2 = new Category("root2");
    const another = new Category("someChild", root2);

    checkDefaultConfig(root2, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(root2));
    checkDefaultConfig(another, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(another));

    expect(CategoryServiceFactory.getLogger(root2) instanceof CategoryDelegateLoggerImpl).toBeTruthy();
  });

  it("New default configuration can be applied to loggers", () => {
    checkDefaultConfig(root1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(root1));

    const checkChangedConfig = (cat: Category, settings: CategoryRuntimeSettings) => {
      expect(settings.category === cat).toBeTruthy();
      expect(settings.loggerType === LoggerType.MessageBuffer).toBeTruthy();
      expect(settings.logFormat.showCategoryName).toBeFalsy();
      expect(settings.logFormat.showTimeStamp).toBeFalsy();
      expect(settings.logFormat.dateFormat.dateSeparator).toEqual("/");
      expect(settings.logFormat.dateFormat.formatEnum === DateFormatEnum.YearDayMonthWithFullTime).toBeTruthy();
      expect(settings.logLevel === LogLevel.Info).toBeTruthy();
      expect(settings.callBackLogger).toBeNull();
    };

    const configChanged = new CategoryDefaultConfiguration(
      LogLevel.Info, LoggerType.MessageBuffer, new CategoryLogFormat(new DateFormat(DateFormatEnum.YearDayMonthWithFullTime, "/"), false, false)
    );
    CategoryServiceFactory.setDefaultConfiguration(configChanged);

    checkChangedConfig(root1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(root1));
    checkChangedConfig(child1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child1));
    checkChangedConfig(child11, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child11));
    checkChangedConfig(child12, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child12));

    CategoryServiceFactory.setDefaultConfiguration(new CategoryDefaultConfiguration());
    checkDefaultConfig(root1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(root1));
    checkDefaultConfig(child1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child1));
    checkDefaultConfig(child11, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child11));
    checkDefaultConfig(child12, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child12));

    // Now without reset, all will still have the previous settings. New categories added will be different.
    CategoryServiceFactory.setDefaultConfiguration(configChanged, false);
    checkDefaultConfig(root1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(root1));
    checkDefaultConfig(child1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child1));
    checkDefaultConfig(child11, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child11));
    checkDefaultConfig(child12, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(child12));

    const anotherRoot = new Category("anotherRoot");
    const anotherChild = new Category("someChild", anotherRoot);

    checkChangedConfig(anotherRoot, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(anotherRoot));
    checkChangedConfig(anotherChild, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(anotherChild));
  });

  it("Can use a custom logger", () => {
    checkDefaultConfig(root1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(root1));

    const messages: string[] = [];
    const configChanged = new CategoryDefaultConfiguration(
       LogLevel.Info, LoggerType.Custom, new CategoryLogFormat(),
      (rootCategory: Category, runtimeSettings: RuntimeSettings) => new CustomLogger(rootCategory, runtimeSettings, messages)
    );
    CategoryServiceFactory.setDefaultConfiguration(configChanged);
    const rootLogger = CategoryServiceFactory.getLogger(root1);
    rootLogger.info("First Message");
    rootLogger.info("Second Message");
    expect(messages).toEqual(["First Message", "Second Message"]);
  });

  it("Can use a custom message formatter", () => {
    checkDefaultConfig(root1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(root1));

    const configChanged = new CategoryDefaultConfiguration(LogLevel.Info, LoggerType.MessageBuffer);
    configChanged.formatterLogMessage = (msg: CategoryLogMessage): string => {
      // Just shorten the message, will only have literal text.
      const message = msg.messageAsString;
      return typeof(message) === "string" ? message : "";
    };
    CategoryServiceFactory.setDefaultConfiguration(configChanged);
    const rootLogger = CategoryServiceFactory.getLogger(root1);
    rootLogger.info("Hello root1!");
    rootLogger.info("Hello child1!", child1);

    expect(getBufferedMessages(rootLogger)).toEqual(["Hello root1!", "Hello child1!"]);
  });

  it("Cannot set custom message formatter when custom logger is used", () => {
    checkDefaultConfig(root1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(root1));

    const messages: string[] = [];
    const configChanged = new CategoryDefaultConfiguration(
      LogLevel.Info, LoggerType.Custom, new CategoryLogFormat(),
      (rootCategory: Category, runtimeSettings: RuntimeSettings) => new CustomLogger(rootCategory, runtimeSettings, messages)
    );
    const formatterLogMessage = (msg: CategoryLogMessage): string => {
      // Just shorten the message, will only have literal text.
      const message = msg.messageAsString;
      return typeof(message) === "string" ? message : "";
    };

    expect(() => configChanged.formatterLogMessage = formatterLogMessage).toThrow("You cannot specify a formatter for log messages if your loggerType is Custom");
    CategoryServiceFactory.setDefaultConfiguration(configChanged);
  });

  it("Can set different custom formatter on category than default", () => {
    checkDefaultConfig(root1, CategoryServiceFactory.getRuntimeSettings().getCategorySettings(root1));

    const defaultConfig = new CategoryDefaultConfiguration(LogLevel.Info, LoggerType.MessageBuffer);
    defaultConfig.formatterLogMessage = (msg: CategoryLogMessage): string => {
      // Just shorten the message, will only have literal text.
      const message = msg.messageAsString;
      return typeof(message) === "string" ? message : "";
    };

    const formatterRoot2 = (msg: CategoryLogMessage): string => {
      return msg.messageAsString + "_postFix";
    };

    const configRoot2 = new CategoryDefaultConfiguration(LogLevel.Debug, LoggerType.MessageBuffer);
    configRoot2.formatterLogMessage = formatterRoot2;

    const root2 = new Category("root2");

    CategoryServiceFactory.setDefaultConfiguration(defaultConfig);
    CategoryServiceFactory.setConfigurationCategory(configRoot2, root2);

    const rootLogger = CategoryServiceFactory.getLogger(root1);
    rootLogger.info("Hello root1!");
    rootLogger.info("Hello child1!", child1);
    const rootLogger2 = CategoryServiceFactory.getLogger(root2);
    rootLogger2.debug("Hello root2!");

    expect(getBufferedMessages(rootLogger)).toEqual(["Hello root1!", "Hello child1!"]);
    expect(getBufferedMessages(rootLogger2)).toEqual(["Hello root2!_postFix"]);
  });

  it("Does not fail reset of category settings", () => {
    const catRoot = new Category("jmod2ts");
    const catRuntime = new Category("runtime", catRoot);

    // Should just succeed (this was a bug) due to resetRootLogger=true flag. Fixed in 0.4.1
    CategoryServiceFactory.setConfigurationCategory(new CategoryDefaultConfiguration(LogLevel.Info), catRoot, true, true);
  });

  class CustomLogger extends AbstractCategoryLogger {

    private messages: Array<string | LogData> = [];

    constructor(rootCategory: Category, runtimeSettings: RuntimeSettings, messages: Array<string | LogData> ) {
      super(rootCategory, runtimeSettings);
      this.messages = messages;
    }

    protected doLog(msg: CategoryLogMessage): void {
      this.messages.push(msg.messageAsString);
    }
  }

});
