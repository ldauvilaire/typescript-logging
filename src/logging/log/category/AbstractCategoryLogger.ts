import {LinkedList} from "../../utils/DataStructures";
import {MessageFormatUtils} from "../../utils/MessageUtils";
import {CategoryLogFormat, LogLevel} from "../LoggerOptions";
import {Category, CategoryLogger} from "./CategoryLogger";
import {RuntimeSettings} from "./CategoryService";
import {LogData} from "../LogData";

/**
 * Contains information about a single log message.
 */
export interface CategoryLogMessage {

  readonly message: string | LogData;

  /**
   * Returns the resolved stack (based on error).
   * Available only when error is present.
   */
  readonly errorAsStack: string | null;

  readonly error: Error | null;

  readonly categories: Category[];

  readonly date: Date;

  readonly level: LogLevel;

  readonly logFormat: CategoryLogFormat;

  readonly isResolvedErrorMessage: boolean;

  /**
   * True if message represents LogData (false for a string message).
   */
  readonly isMessageLogData: boolean;

  /**
   * Always retrieves the message, from either the string directly
   * or in case of LogData from LogData itself.
   */
  readonly messageAsString: string;

  /**
   * If present returns LogData, otherwise null.
   */
  readonly logData: LogData | null;
}

class CategoryLogMessageImpl implements CategoryLogMessage {

  private _message: string | LogData;
  private _error: Error | null;
  private _categories: Category[];
  private _date: Date;
  private _level: LogLevel;
  private _logFormat: CategoryLogFormat;
  private _ready: boolean;

  private _resolvedErrorMessage: boolean = false;
  private _errorAsStack: string | null = null;

  constructor(message: string | LogData, error: Error | null, categories: Category[], date: Date, level: LogLevel, logFormat: CategoryLogFormat, ready: boolean) {
    this._message = message;
    this._error = error;
    this._categories = categories;
    this._date = date;
    this._level = level;
    this._logFormat = logFormat;
    this._ready = ready;
  }

  get message(): string | LogData {
    return this._message;
  }

  get errorAsStack(): string | null {
    return this._errorAsStack;
  }

  get error(): Error | null {
    return this._error;
  }

  get categories(): Category[] {
    return this._categories;
  }

  get date(): Date {
    return this._date;
  }

  get level(): LogLevel {
    return this._level;
  }

  get logFormat(): CategoryLogFormat {
    return this._logFormat;
  }

  get isMessageLogData(): boolean {
    return typeof(this._message) !== "string";
  }

  get messageAsString(): string {
    if (typeof(this._message) === "string") {
      return this._message;
    }
    return this._message.msg;
  }

  get logData(): LogData | null {
    let result: LogData | null = null;
    if (typeof(this._message) !== "string") {
      result = this.message as LogData;
    }
    return result;
  }

  get isResolvedErrorMessage(): boolean {
    return this._resolvedErrorMessage;
  }

  set errorAsStack(stack: string | null) {
    this._errorAsStack = stack;
  }

  public isReady(): boolean {
    return this._ready;
  }

  public setReady(value: boolean): void {
    this._ready = value;
  }

  get resolvedErrorMessage(): boolean {
    return this._resolvedErrorMessage;
  }

  set resolvedErrorMessage(value: boolean) {
    this._resolvedErrorMessage = value;
  }

}

/**
 * Abstract category logger, use as your base class for new type of loggers (it
 * saves you a lot of work) and override doLog(CategoryLogMessage). The message argument
 * provides full access to anything related to the logging event.
 * If you just want the standard line of logging, call: this.createDefaultLogMessage(msg) on
 * this class which will return you the formatted log message as string (e.g. the
 * default loggers all use this).
 */
export abstract class AbstractCategoryLogger implements CategoryLogger {

  private rootCategory: Category;
  private runtimeSettings: RuntimeSettings;

  private allMessages: LinkedList<CategoryLogMessageImpl> = new LinkedList<CategoryLogMessageImpl>();

  constructor(rootCategory: Category, runtimeSettings: RuntimeSettings) {
    this.rootCategory = rootCategory;
    this.runtimeSettings = runtimeSettings;
  }

  public trace(msg: string | LogData, ...categories: Category[]): void {
    this._log(LogLevel.Trace, msg, null, false, ...categories);
  }

  public debug(msg: string | LogData, ...categories: Category[]): void {
    this._log(LogLevel.Debug, msg, null, false, ...categories);
  }

  public info(msg: string | LogData, ...categories: Category[]): void {
    this._log(LogLevel.Info, msg, null, false, ...categories);
  }

  public warn(msg: string | LogData, ...categories: Category[]): void {
    this._log(LogLevel.Warn, msg, null, false, ...categories);
  }

  public error(msg: string | LogData, error: Error, ...categories: Category[]): void {
    this._log(LogLevel.Error, msg, error, false, ...categories);
  }

  public fatal(msg: string | LogData, error: Error, ...categories: Category[]): void {
    this._log(LogLevel.Fatal, msg, error, false, ...categories);
  }

  public resolved(msg: string | LogData, error: Error, ...categories: Category[]): void {
    this._log(LogLevel.Error, msg, error, true, ...categories);
  }

  public log(level: LogLevel, msg: string | LogData, error: Error, ...categories: Category[]): void {
    this._log(level, msg, error, false, ...categories);
  }

  public tracec(msg: () => string | LogData, ...categories: Category[]): void {
    this._logc(LogLevel.Trace, msg, () => null, false, ...categories);
  }

  public debugc(msg: () => string | LogData, ...categories: Category[]): void {
    this._logc(LogLevel.Debug, msg, () => null, false, ...categories);
  }

  public infoc(msg: () => string | LogData, ...categories: Category[]): void {
    this._logc(LogLevel.Info, msg, () => null, false, ...categories);
  }

  public warnc(msg: () => string | LogData, ...categories: Category[]): void {
    this._logc(LogLevel.Warn, msg, () => null, false, ...categories);
  }

  public errorc(msg: () => string | LogData, error: () => Error, ...categories: Category[]): void {
    this._logc(LogLevel.Error, msg, error, false, ...categories);
  }

  public fatalc(msg: () => string | LogData, error: () => Error, ...categories: Category[]): void {
    this._logc(LogLevel.Fatal, msg, error, false, ...categories);
  }

  public resolvedc(msg: () => string | LogData, error: () => Error, ...categories: Category[]): void {
    this._logc(LogLevel.Error, msg, error, true, ...categories);
  }

  public logc(level: LogLevel, msg: () => string | LogData, error: () => Error, ...categories: Category[]): void {
    this._logc(level, msg, error, false, ...categories);
  }

  protected getRootCategory(): Category {
    return this.rootCategory;
  }

  /**
   * Implement this method in your custom logger
   * @param msg Message
   */
  protected abstract doLog(msg: CategoryLogMessage): void;

  protected createDefaultLogMessage(msg: CategoryLogMessage): string {
    return MessageFormatUtils.renderDefaultMessage(msg, true);
  }

  /**
   * Return optional message formatter. All LoggerTypes (except custom) will see if
   * they have this, and if so use it to log.
   * @returns {((message:CategoryLogMessage)=>string)|null}
   */
  protected _getMessageFormatter(): ((message: CategoryLogMessage) => string) | null {
    const categorySettings = this.runtimeSettings.getCategorySettings(this.rootCategory);
    // Should not happen but make ts happy
    if (categorySettings === null) {
      throw new Error("Did not find CategorySettings for rootCategory: " + this.rootCategory.name);
    }
    return categorySettings.formatterLogMessage;
  }

  private _log(level: LogLevel, msg: string | LogData, error: Error | null = null, resolved: boolean = false, ...categories: Category[]): void {
    this._logInternal(level, () => msg, () => error, resolved, ...categories);
  }

  private _logc(level: LogLevel, msg: () => string | LogData, error: () => Error | null, resolved: boolean = false, ...categories: Category[]): void {
    this._logInternal(level, msg, error, resolved, ...categories);
  }

  private _logInternal(level: LogLevel, msg: () => string | LogData, error: () => Error | null, resolved: boolean, ...categories: Category[]): void {
    let logCategories: Category[];

    // Log root category by default if none present
    if (categories !== undefined && categories.length > 0) {
      logCategories = categories;
    }
    else {
      logCategories = [];
      logCategories.push(this.rootCategory);
    }

    // Get the runtime levels for given categories. If their level is lower than given level, we log.
    // In addition we pass along which category/categories we log this statement for.
    for (let i = 0; i < logCategories.length; i++) {
      const category = logCategories[i];
      if (category == null) {
        throw new Error("Cannot have a null element within categories, at index=" + i);
      }
      const settings = this.runtimeSettings.getCategorySettings(category);
      if (settings == null) {
        throw new Error("Category with path: " + category.getCategoryPath() + " is not registered with this logger, maybe " +
          "you registered it with a different root logger?");
      }

      if (settings.logLevel <= level) {
        const actualError = error != null ? error() : null;
        if (actualError == null) {
          const logMessage = new CategoryLogMessageImpl(msg(), actualError, logCategories, new Date(), level, settings.logFormat, true);
          logMessage.resolvedErrorMessage = resolved;
          this.allMessages.addTail(logMessage);
          this.processMessages();
        }
        else {
          const logMessage = new CategoryLogMessageImpl(msg(), actualError, logCategories, new Date(), level, settings.logFormat, false);
          logMessage.resolvedErrorMessage = resolved;
          this.allMessages.addTail(logMessage);
          MessageFormatUtils.renderError(actualError).then((stack: string) => {
            logMessage.errorAsStack = stack;
            logMessage.setReady(true);
            this.processMessages();
          });
        }
        break;
      }
    }

  }

  private processMessages(): void {
    // Basically we wait until errors are resolved (those messages
    // may not be ready).
    const msgs = this.allMessages;
    if (msgs.getSize() > 0) {
      do {
        const msg = msgs.getHead();
        if (msg != null) {
          if (!msg.isReady()) {
            break;
          }
          msgs.removeHead();
          this.doLog(msg);
        }
      }
      while (msgs.getSize() > 0);
    }
  }

}
